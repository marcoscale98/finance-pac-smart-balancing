# GitHub Issue Relationships via GraphQL

`gh issue` non supporta nativamente le relazioni tra issue. Usare sempre `gh api graphql`.

## Ottenere i node ID

```bash
gh api repos/OWNER/REPO/issues --jq '.[] | {number: .number, node_id: .node_id}'
```

## Sub-issue (relazione padre/figlio)

```graphql
mutation {
  addSubIssue(input: { issueId: "PARENT_NODE_ID", subIssueId: "CHILD_NODE_ID" }) {
    issue { number }
    subIssue { number }
  }
}
```

## Blocked-by (relazione di dipendenza)

```graphql
mutation {
  addBlockedBy(input: { issueId: "BLOCKED_NODE_ID", blockingIssueId: "BLOCKER_NODE_ID" }) {
    issue { number }
    blockingIssue { number }
  }
}
```

`issueId` = issue bloccata; `blockingIssueId` = issue che blocca.

## Per aggiungere più relazioni in loop (bash)

```bash
declare -a PAIRS=(
  "BLOCKED_NODE_ID_1|BLOCKER_NODE_ID_1"
  "BLOCKED_NODE_ID_2|BLOCKER_NODE_ID_2"
)

for pair in "${PAIRS[@]}"; do
  issue_id="${pair%%|*}"
  blocking_id="${pair##*|}"
  gh api graphql -f query="
  mutation {
    addBlockedBy(input: { issueId: \"$issue_id\", blockingIssueId: \"$blocking_id\" }) {
      issue { number }
      blockingIssue { number }
    }
  }" --jq '.data.addBlockedBy | "#\(.blockingIssue.number) blocks #\(.issue.number)"'
done
```
