# Architecture

```mermaid
flowchart LR
  Config["JSON Config"] --> CLI["CLI Commands"]
  CLI --> GitHub["GitHub Adapter"]
  CLI --> Algora["Algora Adapter"]
  CLI --> Opire["Opire Adapter"]
  GitHub --> Candidates["Unified Candidates"]
  Algora --> Candidates
  Opire --> Candidates
  Candidates --> Scoring["Scoring + Analysis"]
  Scoring --> Reports["Markdown / JSON / HTML"]
  Scoring --> Dashboard["Scan Dashboard"]
  CLI --> Watch["PR Watch"]
  Watch --> WatchDashboard["Watch Dashboard"]
  Reports --> History["history.jsonl"]
  WatchDashboard --> History
```

Open Bounty Radar keeps the core workflow local-first:

- adapters normalize external sources into candidate objects
- scoring and analysis stay explainable
- reports are generated as portable files
- dashboards are static HTML with optional local serving
- history is append-only JSONL for lightweight trend tracking
