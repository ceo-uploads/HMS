const fs = require('node:fs/promises');
const path = require('node:path');

const owner = 'ceo-uploads';
const repo = 'HMS';
const version = require('../package.json').version;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const metadataPath = path.join(__dirname, '..', 'release', 'latest.yml');

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body.slice(0, 400)}`);
  }
  return response;
}

async function main() {
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required to publish update metadata.');

  const metadata = await fs.readFile(metadataPath);
  if (!metadata.toString('utf8').includes(`version: ${version}`)) {
    throw new Error(`release/latest.yml does not describe package version ${version}. Rebuild before publishing.`);
  }

  const releaseResponse = await request(`https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version}`);
  const release = await releaseResponse.json();
  if (release.draft) throw new Error(`GitHub release v${version} is still a draft; publish it before clients check for updates.`);

  const existingMetadata = release.assets.find(asset => asset.name === 'latest.yml');
  if (existingMetadata) {
    console.log(`Verified latest.yml is attached to GitHub release v${version}.`);
    return;
  }

  const uploadUrl = release.upload_url.replace(/\{.*$/, '');
  await request(`${uploadUrl}?name=latest.yml`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: metadata
  });
  console.log(`Uploaded latest.yml to GitHub release v${version}.`);
}

main().catch(error => {
  console.error(`Could not verify the GitHub update feed: ${error.message}`);
  process.exitCode = 1;
});