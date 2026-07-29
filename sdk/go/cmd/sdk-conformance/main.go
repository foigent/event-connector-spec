package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/foigent/event-connector-spec/sdk/go/testkit"
)

func main() {
	root := flag.String("protocol-root", "", "event-connector-spec checkout")
	reportPath := flag.String("report", "", "output report path")
	flag.Parse()
	if *root == "" || *reportPath == "" {
		fmt.Fprintln(os.Stderr, "usage: sdk-conformance --protocol-root <path> --report <path>")
		os.Exit(2)
	}
	report, err := testkit.Build(*root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(3)
	}
	bytes, err := testkit.Marshal(report)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(4)
	}
	if err := os.WriteFile(*reportPath, bytes, 0o600); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(4)
	}
	fmt.Printf("Foigent Go SDK candidate: pass (%d cases)\n", len(report.Cases))
}
