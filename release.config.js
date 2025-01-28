export default {
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/changelog",
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
        assets: [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
          "pnpm-lock.yaml",
          "npm-shrinkwrap.json",
        ],
      },
    ],
  ],
};
