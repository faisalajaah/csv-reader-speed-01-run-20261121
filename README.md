# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/faisalajaah/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/faisalajaah/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0: a single-pass CSV reader that returns exactly csv-reader's `{columns, rows, errors}` for every broken input — stray CRs, unterminated quotes, junk after closing quotes, short and long rows — about 5x faster than the reference on the practice set. The reference reads one character at a time and builds every field a character at a time; this one scans code units and cuts each field out with `slice()`, so a field costs one slice (plus a join only when a stray CR, a doubled quote or a CR inside quotes splits it).

## Run it

```sh
MAKEFUN_INPUT_DIR=<input dir> MAKEFUN_OUTPUT_DIR=<output dir> node main.ts
```

`main.ts` reads every case from `<input dir>/cases.json`, answers each one with `run()` from `solve.js`, and writes `<output dir>/answers.json`. Without the environment variables it reads `/input/cases.json` and writes `/output/answers.json`, as the harness runs it.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9eqj58cc&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
