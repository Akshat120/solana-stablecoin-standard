// Entry point for Trident / honggfuzz fuzz target fuzz_0.
// Run with:
//   trident fuzz run fuzz_0
// Or directly with honggfuzz:
//   cargo hfuzz run fuzz_0

use honggfuzz::fuzz;
use arbitrary::Unstructured;

// Reference fuzz_instructions.rs from the package root
#[path = "../../fuzz_instructions.rs"]
mod fuzz_instructions;

fn main() {
    loop {
        fuzz!(|data: &[u8]| {
            let mut u = Unstructured::new(data);
            fuzz_instructions::run_all(&mut u);
        });
    }
}
