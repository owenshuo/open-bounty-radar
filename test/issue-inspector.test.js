import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectIssue, inspectIssues, parseIssueUrl, renderIssueInspectionBatchHtml, renderIssueInspectionBatchMarkdown, renderIssueInspectionMarkdown} from '../src/issue-inspector.js';

test('parses GitHub issue URLs for inspection', () => {
  assert.deepEqual(parseIssueUrl('https://github.com/owner/repo/issues/123'), {
    owner: 'owner',
    repo: 'repo',
    number: 123,
    fullName: 'owner/repo',
  });
});

test('batch inspects issues and records failures', async () => {
  const client = {
    async getIssue({number}) {
      if (number === 4) throw new Error('not found');
      return {
        title: 'Fix paid bug',
        body: '/bounty $500\nSteps to reproduce: run it. Expected behavior: pass. Actual behavior: fail.',
        html_url: 'https://github.com/o/r/issues/3',
        state: 'open',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: new Date().toISOString(),
        labels: [],
        assignees: [],
      };
    },
    async searchPullRequestsForIssue() {
      return [];
    },
    async listTimelinePullRequestsForIssue() {
      return [];
    },
    async listIssueTimeline() {
      return [];
    },
  };

  const report = await inspectIssues(client, {issueUrls: ['https://github.com/o/r/issues/3', 'https://github.com/o/r/issues/4']});
  assert.equal(report.candidates.length, 1);
  assert.equal(report.errors.length, 1);
  assert.match(renderIssueInspectionBatchMarkdown(report), /Issue Inspection Batch/);
  assert.match(renderIssueInspectionBatchHtml(report), /Open Bounty Radar Issue Inspection/);
  assert.match(renderIssueInspectionBatchHtml(report), /<table>/);
  assert.match(renderIssueInspectionBatchHtml({...report, candidates: [{...report.candidates[0], detailPath: 'issue-details/o__r__3.html'}]}), /issue-details\/o__r__3\.html/);
  assert.match(renderIssueInspectionBatchHtml({...report, candidates: [{...report.candidates[0], detailPath: 'issue-details/o__r__3.html'}]}), />GitHub<\/a>/);
});

test('inspects a single issue into a candidate and markdown report', async () => {
  const client = {
    async getIssue() {
      return {
        title: 'Fix paid bug',
        body: '/bounty $500\nSteps to reproduce: run it. Expected behavior: pass. Actual behavior: fail.',
        html_url: 'https://github.com/o/r/issues/3',
        state: 'open',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: new Date().toISOString(),
        labels: [{name: 'bounty'}],
        assignees: [],
      };
    },
    async searchPullRequestsForIssue() {
      return [];
    },
    async listTimelinePullRequestsForIssue() {
      return [];
    },
    async listIssueTimeline() {
      return [];
    },
  };

  const candidate = await inspectIssue(client, {issueUrl: 'https://github.com/o/r/issues/3'});
  assert.equal(candidate.amount, 500);
  assert.equal(candidate.assessment.verdict, 'start-now');
  assert.match(renderIssueInspectionMarkdown(candidate), /Issue Inspection: o\/r#3/);
});
