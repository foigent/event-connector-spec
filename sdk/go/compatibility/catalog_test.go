package compatibility

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDigestPinnedCatalogFailsClosed(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "compatibility-catalog.v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := Load(data)
	if err != nil {
		t.Fatal(err)
	}
	pins := catalog.Pins()
	if len(pins) != 3 {
		t.Fatalf("unexpected compatibility pin count: %d", len(pins))
	}
	for _, pin := range pins {
		if err := catalog.Validate(pin); err != nil {
			t.Fatal(err)
		}
	}
	pins[0].ProtocolVersion = "latest"
	if err := catalog.Validate(pins[0]); err == nil {
		t.Fatal("unknown compatibility tuple must fail closed")
	}
	if catalog.Pins()[0].ProtocolVersion == "latest" {
		t.Fatal("catalog leaked its tuple backing slice")
	}
	tampered := append([]byte(nil), data...)
	tampered[len(tampered)-2] ^= 1
	if _, err := Load(tampered); err == nil {
		t.Fatal("tampered compatibility catalog must fail closed")
	}
	if err := ValidateReleasedSourceRevision("1"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateReleasedSourceRevision("2"); err == nil {
		t.Fatal("unknown Source revision must fail closed")
	}
}
