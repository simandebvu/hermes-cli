# Git Strategy for Hermes

## Branch Strategy

### Main Branches
1. **`main`** - Production-ready code
   - Only stable, tested releases
   - Protected branch (require PR reviews)
   - Tagged with semantic versions (v0.1.0, v0.2.0)
   - Deployed to npm from here

2. **`develop`** - Integration branch
   - Active development happens here
   - Features merge into develop first
   - Tested before merging to main
   - Pre-release versions (v0.2.0-beta.1)

### Supporting Branches (when needed)
3. **`feature/*`** - New features
   - Branch from: develop
   - Merge to: develop
   - Example: `feature/ticket-integration`

4. **`bugfix/*`** - Bug fixes
   - Branch from: develop
   - Merge to: develop
   - Example: `bugfix/stats-calculation`

5. **`hotfix/*`** - Production fixes
   - Branch from: main
   - Merge to: main AND develop
   - Example: `hotfix/copilot-auth-error`

6. **`release/*`** - Release preparation
   - Branch from: develop
   - Merge to: main AND develop
   - Example: `release/v0.2.0`

## Commit Strategy

### Conventional Commits Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintain (package updates, build config)

**Examples:**
```
feat(init): add project initialization command
fix(stats): correct time calculation for efficiency metrics
docs(readme): add efficiency features section
chore(build): update TypeScript to 5.3.3
```

## Initial Commit Plan

### Phase 1: Foundation (Commits 1-4)
1. **Project setup** - package.json, tsconfig, build config
2. **Core utilities** - Git operations, Copilot integration
3. **Display utilities** - Terminal output formatting
4. **Basic commands** - plan, start, wip, sync

### Phase 2: Advanced Features (Commits 5-7)
5. **Conflict resolution** - explain and apply commands
6. **Worktree management** - worktree command
7. **Configuration system** - init command and config utilities

### Phase 3: Efficiency Features (Commits 8-10)
8. **Analytics system** - stats command and tracking
9. **Workflow shortcuts** - workflow command
10. **Documentation** - README, guides, vision docs

### Phase 4: Polish (Commit 11)
11. **Build and release prep** - finalize package, changelog

## Protection Rules (GitHub)

### For `main` branch:
- ✅ Require pull request reviews (1+ approvals)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### For `develop` branch:
- ✅ Require pull request reviews (optional for solo dev)
- ✅ Allow force pushes (for rebasing)
- ✅ Require status checks to pass

## Release Process

1. **Development** on `develop` branch
2. **Create release branch**: `release/v0.2.0` from develop
3. **Test & fix** on release branch
4. **Merge to main** with tag: `v0.2.0`
5. **Merge back to develop**
6. **Publish to npm** from main

## Version Tags

- `v0.1.0` - Initial release (basic commands)
- `v0.2.0` - Efficiency features (init, stats, workflow)
- `v0.3.0` - Integration features (tickets, IDE, CI/CD)
- `v1.0.0` - Stable, production-ready

## Additional Suggestions

### GitHub Actions (CI/CD)
```yaml
# .github/workflows/test.yml
- Build check on PRs
- TypeScript typecheck
- Run tests (when added)
- Lint code
```

### GitHub Labels
- `enhancement` - New features
- `bug` - Bug fixes
- `documentation` - Docs improvements
- `good first issue` - For contributors
- `help wanted` - Community input needed

### GitHub Templates
- Pull request template
- Issue templates (bug, feature request)
- Contributing guidelines

### Pre-commit Hooks (optional)
- Run typecheck before commit
- Lint staged files
- Run tests (when added)

## Workflow Example

```bash
# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/ticket-integration

# Work on feature
# ... make changes ...
git add .
git commit -m "feat(integrations): add Linear ticket integration"

# Push feature
git push -u origin feature/ticket-integration

# Create PR: feature/ticket-integration -> develop
# After review & approval, merge to develop

# When ready for release
git checkout develop
git pull origin develop
git checkout -b release/v0.3.0

# Final testing, version bump
# Update package.json, CHANGELOG.md

# Merge to main
git checkout main
git merge --no-ff release/v0.3.0
git tag -a v0.3.0 -m "Release v0.3.0: Integration features"
git push origin main --tags

# Merge back to develop
git checkout develop
git merge --no-ff release/v0.3.0
git push origin develop
```

## Summary

**Main** → Stable releases only
**Develop** → Active development
**Feature branches** → When needed for isolation
**Conventional commits** → Clear history
**Semantic versioning** → v0.2.0 format
**Protected branches** → Safe collaboration
