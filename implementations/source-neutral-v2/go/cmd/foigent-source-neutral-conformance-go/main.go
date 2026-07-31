package main

import (
	"fmt"
	"os"

	"github.com/foigent/event-connector-spec/implementations/source-neutral-v2/go/internal/conformance"
)

func main() {
	bundle, report, ok := parseArgs(os.Args[1:])
	if !ok {
		fmt.Fprintln(os.Stderr, "invalid invocation")
		os.Exit(2)
	}
	summary, exitCode, err := conformance.Execute(bundle, report)
	if err != nil {
		fmt.Fprintln(os.Stderr, bounded(err.Error()))
		os.Exit(exitCode)
	}
	fmt.Printf(
		"go source-neutral conformance: %s (%d cases)\n",
		summary.Status,
		summary.CaseCount,
	)
	os.Exit(exitCode)
}

func parseArgs(args []string) (string, string, bool) {
	if len(args) != 4 {
		return "", "", false
	}
	values := make(map[string]string, 2)
	for index := 0; index < len(args); index += 2 {
		flag := args[index]
		value := args[index+1]
		if (flag != "--bundle" && flag != "--report") ||
			value == "" || values[flag] != "" {
			return "", "", false
		}
		values[flag] = value
	}
	bundle := values["--bundle"]
	report := values["--report"]
	return bundle, report, bundle != "" && report != "" && bundle != report
}

func bounded(value string) string {
	if len(value) <= 512 {
		return value
	}
	return value[:512]
}
