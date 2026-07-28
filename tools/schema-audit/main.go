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
	requestCompletedV1      = "foigent://events/model/request-completed/v1"
	requestCompletedV2      = "foigent://events/model/request-completed/v2"
	liteLLMSourceSchema     = "foigent://sources/litellm/spend-log/v1"
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
		requestCompletedV1,
		requestCompletedV2,
		liteLLMSourceSchema,
	} {
		if compiled[required] == nil {
			return fmt.Errorf("required schema is absent: %s", required)
		}
	}

	manifestNames := []string{
		"foigent.unirouter.completed-execution-1.0.0.json",
		"foigent.litellm.spend-logs-1.0.0.json",
	}
	for _, name := range manifestNames {
		manifest, err := readJSON(filepath.Join(root, "manifests", name))
		if err != nil {
			return err
		}
		if err := compiled[connectorManifestSchema].Validate(manifest); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
	}

	bundles := []struct {
		path          string
		payloadSchema string
		sourceSchema  string
	}{
		{"vectors/canonical-vector-bundle.v1.json", requestCompletedV1, ""},
		{"vectors/litellm-connector-vector-bundle.v1.json", requestCompletedV2, liteLLMSourceSchema},
	}
	envelopeCount := 0
	for _, item := range bundles {
		count, err := validateVectorBundle(root, item.path, item.payloadSchema, item.sourceSchema, compiled)
		if err != nil {
			return err
		}
		envelopeCount += count
	}

	fmt.Printf(
		"schema audit passed: %d schemas, %d manifests, %d envelopes/payloads\n",
		len(compiled),
		len(manifestNames),
		envelopeCount,
	)
	return nil
}

func validateVectorBundle(
	root string,
	bundlePath string,
	payloadSchema string,
	sourceSchema string,
	compiled map[string]*jsonschema.Schema,
) (int, error) {
	bundleValue, err := readJSON(filepath.Join(root, filepath.FromSlash(bundlePath)))
	if err != nil {
		return 0, err
	}
	bundle, ok := bundleValue.(map[string]any)
	if !ok {
		return 0, fmt.Errorf("%s: bundle is not an object", bundlePath)
	}
	vectorValues, ok := bundle["canonical_envelopes"].([]any)
	if !ok || len(vectorValues) == 0 {
		return 0, fmt.Errorf("%s: canonical_envelopes is absent or empty", bundlePath)
	}
	for _, entry := range vectorValues {
		vector, ok := entry.(map[string]any)
		if !ok {
			return 0, errors.New("canonical envelope vector is not an object")
		}
		caseID, ok := vector["case_id"].(string)
		if !ok || caseID == "" {
			return 0, errors.New("canonical envelope vector has no case_id")
		}
		inputPath, ok := vector["input_path"].(string)
		if !ok || inputPath == "" {
			return 0, fmt.Errorf("%s: input_path is absent", caseID)
		}
		envelopeValue, err := readJSON(filepath.Join(root, filepath.FromSlash(inputPath)))
		if err != nil {
			return 0, err
		}
		envelope, ok := envelopeValue.(map[string]any)
		if !ok {
			return 0, fmt.Errorf("%s: envelope is not an object", caseID)
		}
		integrity, ok := envelope["integrity"].(map[string]any)
		if !ok {
			return 0, fmt.Errorf("%s: integrity is not an object", caseID)
		}
		envelopeHash, ok := vector["envelope_hash"].(string)
		if !ok || envelopeHash == "" {
			return 0, fmt.Errorf("%s: envelope_hash is absent", caseID)
		}
		integrity["envelope_hash"] = envelopeHash
		if err := compiled[eventEnvelopeSchema].Validate(envelope); err != nil {
			return 0, fmt.Errorf("%s envelope: %w", caseID, err)
		}
		if err := compiled[payloadSchema].Validate(envelope["payload"]); err != nil {
			return 0, fmt.Errorf("%s payload: %w", caseID, err)
		}
		if sourceSchema != "" {
			sourcePath, ok := vector["source_input_path"].(string)
			if !ok || sourcePath == "" {
				return 0, fmt.Errorf("%s: source_input_path is absent", caseID)
			}
			source, err := readJSON(filepath.Join(root, filepath.FromSlash(sourcePath)))
			if err != nil {
				return 0, err
			}
			if err := compiled[sourceSchema].Validate(source); err != nil {
				return 0, fmt.Errorf("%s Source record: %w", caseID, err)
			}
		}
	}
	return len(vectorValues), nil
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
