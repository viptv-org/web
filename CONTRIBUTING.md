# Contributing to the VIPTV account web app

Thanks for your interest. VIPTV is a multi-repository product; this repository owns the account and admin web screens. The viewing client lives in [viptv-org/tv-web](https://github.com/viptv-org/tv-web).

## Workflow

1. Product behavior starts in [viptv-org/design](https://github.com/viptv-org/design). Read the pinned `DESIGN_REF` commit before changing screens; record proposed UX changes in design first.
2. Search this repository's GitHub Issues before opening a new one.
3. Never commit credentials, tokens, provider URLs or user data; keep screenshots out of the repository.
4. Validate before pushing: `npm run test`, `npm run build` (includes the design snapshot check and a strict TypeScript build).

## License

Contributions are licensed under the GNU General Public License v2.0 only (see [LICENSE](LICENSE)). By contributing you agree your work is licensed under it.
