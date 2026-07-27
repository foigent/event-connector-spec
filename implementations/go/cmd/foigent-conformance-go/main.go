package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/foigent/event-connector-spec/implementations/go/internal/conformance"
)

func main() {
	os.Exit(run())
}

func run() int {
	flags := flag.NewFlagSet("foigent-conformance-go", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)

	var bundlePath string
	var reportPath string
	flags.StringVar(&bundlePath, "bundle", "", "canonical vector bundle path")
	flags.StringVar(&reportPath, "report", "", "conformance report output path")

	if err := flags.Parse(os.Args[1:]); err != nil {
		return conformance.ExitInternalFailure
	}
	if bundlePath == "" || reportPath == "" || flags.NArg() != 0 {
		fmt.Fprintln(os.Stderr, "exactly --bundle <bundle> --report <report> is required")
		return conformance.ExitInternalFailure
	}

	summary, exitCode, err := conformance.Execute(bundlePath, reportPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return exitCode
	}
	fmt.Printf("go conformance: %s (%d cases)\n", summary.Status, summary.CaseCount)
	return exitCode
}
