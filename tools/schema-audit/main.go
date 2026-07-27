package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

const (
	connectorManifestSchema = "foigent://schemas/connector-manifest/v1"
	eventEnvelopeSchema     = "foigent://schemas/event-envelope/v1"
	requestCompletedSchema  = "foigent://events/model/request-completed/v1"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "schema audit failed: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: schema-audit <protocol-root>")
	}
	root, err := filepath.Abs(args[0])
	if err != nil {
		return err
	}
	paths, err := filepath.Glob(filepath.Join(root, "schemas", "*.json"))
	if err != nil {
		return err
	}
	sort.Strings(paths)
	if len(paths) == 0 {
		return errors.New("no schemas found")
	}

	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.AssertFormat()
	ids := make(map[string]string, len(paths))
	for _, path := range paths {
		value, err := readJSON(path)
		if err != nil {
			return err
		}
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: schema is not an object", path)
		}
		id, ok := object["$id"].(string)
		if !ok || id == "" {
			return fmt.Errorf("%s: missing $id", path)
		}
		if previous := ids[id]; previous != "" {
			return fmt.Errorf("duplicate schema id %s: %s and %s", id, previous, path)
		}
		ids[id] = path
		if err := compiler.AddResource(id, value); err != nil {
			return fmt.Errorf("%s: add resource: %w", path, err)
		}
	}

	compiled := make(map[string]*jsonschema.Schema, len(ids))
	for id, path := range ids {
		schema, err := compiler.Compile(id)
		if err != nil {
			return fmt.Errorf("%s: compile: %w", path, err)
		}
		compiled[id] = schema
	}
	for _, required := range []string{
		connectorManifestSchema,
		eventEnvelopeSchema,
		requestCompletedSchema,
	} {
		if compiled[required] == nil {
			return fmt.Errorf("required schema is absent: %s", required)
		}
	}

	manifest, err := readJSON(filepath.Join(
		root,
		"manifests",
		"foigent.unirouter.completed-execution-1.0.0.json",
	))
	if err != nil {
		return err
	}
	if err := compiled[connectorManifestSchema].Validate(manifest); err != nil {
		return fmt.Errorf("connector manifest: %w", err)
	}

	bundleValue, err := readJSON(filepath.Join(
		root,
		"vectors",
		"canonical-vector-bundle.v1.json",
	))
	if err != nil {
		return err
	}
	bundle, ok := bundleValue.(map[string]any)
	if !ok {
		return errors.New("canonical vector bundle is not an object")
	}
	vectorValues, ok := bundle["canonical_envelopes"].([]any)
	if !ok || len(vectorValues) == 0 {
		return errors.New("canonical_envelopes is absent or empty")
	}
	for _, entry := range vectorValues {
		vector, ok := entry.(map[string]any)
		if !ok {
			return errors.New("canonical envelope vector is not an object")
		}
		caseID, ok := vector["case_id"].(string)
		if !ok || caseID == "" {
			return errors.New("canonical envelope vector has no case_id")
		}
		inputPath, ok := vector["input_path"].(string)
		if !ok || inputPath == "" {
			return fmt.Errorf("%s: input_path is absent", caseID)
		}
		envelopeValue, err := readJSON(filepath.Join(root, filepath.FromSlash(inputPath)))
		if err != nil {
			return err
		}
		envelope, ok := envelopeValue.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: envelope is not an object", caseID)
		}
		integrity, ok := envelope["integrity"].(map[string]any)
		if !ok {
			return fmt.Errorf("%s: integrity is not an object", caseID)
		}
		envelopeHash, ok := vector["envelope_hash"].(string)
		if !ok || envelopeHash == "" {
			return fmt.Errorf("%s: envelope_hash is absent", caseID)
		}
		integrity["envelope_hash"] = envelopeHash
		if err := compiled[eventEnvelopeSchema].Validate(envelope); err != nil {
			return fmt.Errorf("%s envelope: %w", caseID, err)
		}
		if err := compiled[requestCompletedSchema].Validate(envelope["payload"]); err != nil {
			return fmt.Errorf("%s payload: %w", caseID, err)
		}
	}

	fmt.Printf(
		"schema audit passed: %d schemas, 1 manifest, %d envelopes/payloads\n",
		len(compiled),
		len(vectorValues),
	)
	return nil
}

func readJSON(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return value, nil
}
