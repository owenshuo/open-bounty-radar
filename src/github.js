const GITHUB_API = 'https://api.github.com';

function splitFullName(fullName) {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error(`Invalid GitHub repository full name: ${fullName}`);
  return [owner, repo];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GitHubClient {
  constructor({token, fetchImpl = fetch} = {}) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(path, searchParams = {}) {
    const url = new URL(`${GITHUB_API}${path}`);
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'open-bounty-radar',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.fetchImpl(url, {headers});
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      const resetSeconds = Number(response.headers.get('x-ratelimit-reset') ?? 0);
      const waitMs = Math.max(0, resetSeconds * 1000 - Date.now()) + 1000;
      await sleep(Math.min(waitMs, 60_000));
      return this.request(path, searchParams);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub request failed ${response.status}: ${url.toString()}\n${body}`);
    }
    return response.json();
  }

  async searchIssues({fullName, query, maxIssues = 25, includeClosed = false}) {
    const state = includeClosed ? '' : 'is:open';
    const q = [`repo:${fullName}`, 'is:issue', state, query].filter(Boolean).join(' ');
    const data = await this.request('/search/issues', {
      q,
      sort: 'updated',
      order: 'desc',
      per_page: Math.min(maxIssues, 100),
    });
    return data.items ?? [];
  }

  async searchGlobalIssues({query, maxIssues = 25, includeClosed = false}) {
    const state = includeClosed ? '' : 'is:open';
    const q = ['is:issue', state, query].filter(Boolean).join(' ');
    const data = await this.request('/search/issues', {
      q,
      sort: 'updated',
      order: 'desc',
      per_page: Math.min(maxIssues, 100),
    });
    return data.items ?? [];
  }

  async searchPullRequestsForIssue({fullName, issueNumber, issueUrl}) {
    const queries = [
      `repo:${fullName} is:pr ${issueUrl}`,
      `repo:${fullName} is:pr "#${issueNumber}"`,
      `repo:${fullName} is:pr "${fullName}#${issueNumber}"`,
    ];
    const byUrl = new Map();

    for (const q of queries) {
      const data = await this.request('/search/issues', {
        q,
        sort: 'updated',
        order: 'desc',
        per_page: 20,
      });
      for (const item of data.items ?? []) byUrl.set(item.html_url, item);
    }

    return [...byUrl.values()];
  }

  async getPullRequest({fullName, number}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/pulls/${number}`);
  }

  async getIssue({fullName, number}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/issues/${number}`);
  }

  async listIssueComments({fullName, number, perPage = 20}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/issues/${number}/comments`, {
      per_page: perPage,
    });
  }

  async listPullRequestReviews({fullName, number, perPage = 20}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
      per_page: perPage,
    });
  }

  async listIssueTimeline({fullName, number, perPage = 100}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/issues/${number}/timeline`, {
      per_page: perPage,
    });
  }

  async listTimelinePullRequestsForIssue({fullName, number, perPage = 100}) {
    const timeline = await this.listIssueTimeline({fullName, number, perPage});
    return timeline
      .map((event) => event.source?.issue)
      .filter((issue) => issue?.pull_request && issue.html_url?.includes(`/${fullName}/pull/`));
  }

  async listCheckRuns({fullName, ref, perPage = 100}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/commits/${ref}/check-runs`, {
      per_page: perPage,
    });
  }

  async getCombinedStatus({fullName, ref}) {
    const [owner, repo] = splitFullName(fullName);
    return this.request(`/repos/${owner}/${repo}/commits/${ref}/status`);
  }
}
