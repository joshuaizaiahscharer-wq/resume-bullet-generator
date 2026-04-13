#!/usr/bin/env bash
set -u

echo "=== Vercel CLI PATH Fix (macOS + zsh) ==="

echo "[1/7] Detecting npm global prefix..."
prefix="$(npm config get prefix 2>/dev/null || true)"
if [[ -z "${prefix}" || "${prefix}" == "undefined" ]]; then
  echo "Error: Could not detect npm global prefix."
  exit 1
fi

echo "npm prefix: ${prefix}"
bin_dir="${prefix}/bin"
echo "npm global bin dir: ${bin_dir}"

zshrc="${HOME}/.zshrc"
path_line='export PATH="$(npm config get prefix)/bin:$PATH"'

echo "[2/7] Ensuring ~/.zshrc exists..."
if [[ ! -f "${zshrc}" ]]; then
  touch "${zshrc}"
  echo "Created ${zshrc}"
fi

echo "[3/7] Ensuring PATH line exists in ~/.zshrc (idempotent)..."
if grep -Fq "${path_line}" "${zshrc}"; then
  echo "PATH line already present in ${zshrc}"
else
  {
    echo ""
    echo "# Added by fix-vercel-path.sh"
    echo "${path_line}"
  } >> "${zshrc}"
  echo "Added PATH line to ${zshrc}"
fi

echo "[4/7] Exporting npm global bin dir in current shell..."
case ":${PATH}:" in
  *":${bin_dir}:"*)
    echo "Current PATH already contains ${bin_dir}"
    ;;
  *)
    export PATH="${bin_dir}:${PATH}"
    echo "Temporarily added ${bin_dir} to PATH"
    ;;
esac

echo "[5/7] Reloading ~/.zshrc..."
# shellcheck disable=SC1090
if source "${zshrc}"; then
  echo "Reloaded ${zshrc}"
else
  echo "Warning: Could not source ${zshrc} in this shell. New terminals will still pick up changes."
fi

echo "[6/7] Verifying Vercel CLI..."
if command -v vercel >/dev/null 2>&1; then
  echo "Found vercel at: $(command -v vercel)"
  vercel --version
  echo "vercel command works."
else
  echo "vercel command still not found; trying npx fallback..."
  npx --yes vercel --version
  echo "npx fallback works."
fi

echo "[7/7] Done."
