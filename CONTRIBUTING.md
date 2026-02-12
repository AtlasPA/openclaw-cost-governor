# Contributing to OpenClaw Cost Governor

Thank you for your interest in contributing! This project is open source and welcomes contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version, OpenClaw version)

### Suggesting Features

Feature requests are welcome! Please open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Why this would be useful to other users

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Use ES modules (import/export)
- Follow existing code style
- Add comments for complex logic
- Keep functions focused and small

### Testing

Before submitting a PR:
- Test with OpenClaw locally
- Verify CLI commands work
- Check dashboard loads correctly
- Test with different budget configurations

## Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/openclaw-cost-governor

# Install dependencies
cd openclaw-cost-governor
npm install

# Run setup
npm run setup

# Test CLI
node src/cli.js status

# Test dashboard
node src/cli.js dashboard
```

## Questions?

Open an issue or reach out to the maintainer.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
