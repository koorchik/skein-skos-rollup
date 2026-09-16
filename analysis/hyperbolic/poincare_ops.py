"""Poincaré-ball operations with curvature c (ball radius 1/sqrt(c)). numpy only, ~40 lines.

Own implementation on purpose: the sidecar needs five formulas, not geoopt. Conventions follow
Ganea et al. 2018 (Hyperbolic neural networks). Vectors are 1-D numpy arrays or (n, d) matrices;
every function broadcasts over the leading axis.

    python poincare_ops.py          # runs the self-tests (also `python -m pytest poincare_ops.py`)
"""
from __future__ import annotations

import numpy as np

EPS = 1e-9


def _sqnorm(x: np.ndarray) -> np.ndarray:
    return np.sum(x * x, axis=-1, keepdims=True)


def mobius_add(x: np.ndarray, y: np.ndarray, c: float) -> np.ndarray:
    """x ⊕_c y."""
    xy = np.sum(x * y, axis=-1, keepdims=True)
    x2, y2 = _sqnorm(x), _sqnorm(y)
    num = (1 + 2 * c * xy + c * y2) * x + (1 - c * x2) * y
    den = 1 + 2 * c * xy + c * c * x2 * y2
    return num / np.maximum(den, EPS)


def dist(x: np.ndarray, y: np.ndarray, c: float) -> np.ndarray:
    """Geodesic distance d_c(x, y) = (2/√c) artanh(√c ‖(−x) ⊕ y‖)."""
    sc = np.sqrt(c)
    arg = np.clip(sc * np.linalg.norm(mobius_add(-x, y, c), axis=-1), 0.0, 1 - EPS)
    return (2.0 / sc) * np.arctanh(arg)


def dist0(x: np.ndarray, c: float) -> np.ndarray:
    """Distance from the origin: (2/√c) artanh(√c ‖x‖). Small = general (HiT's centripetal order)."""
    sc = np.sqrt(c)
    return (2.0 / sc) * np.arctanh(np.clip(sc * np.linalg.norm(x, axis=-1), 0.0, 1 - EPS))


def expmap0(v: np.ndarray, c: float) -> np.ndarray:
    """Tangent vector at the origin → ball point: tanh(√c‖v‖) v / (√c‖v‖)."""
    sc = np.sqrt(c)
    n = np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), EPS)
    return np.tanh(sc * n) * v / (sc * n)


def logmap0(y: np.ndarray, c: float) -> np.ndarray:
    """Ball point → tangent vector at the origin: artanh(√c‖y‖) y / (√c‖y‖)."""
    sc = np.sqrt(c)
    n = np.maximum(np.linalg.norm(y, axis=-1, keepdims=True), EPS)
    return np.arctanh(np.clip(sc * n, 0.0, 1 - EPS)) * y / (sc * n)


def project(x: np.ndarray, c: float, margin: float = 1e-5) -> np.ndarray:
    """Clip a point back inside the ball of radius 1/√c (LM outputs can graze the boundary)."""
    max_norm = (1 - margin) / np.sqrt(c)
    n = np.linalg.norm(x, axis=-1, keepdims=True)
    return np.where(n > max_norm, x * (max_norm / np.maximum(n, EPS)), x)


# --- self-tests -------------------------------------------------------------------------------------

def test_identities() -> None:
    rng = np.random.default_rng(42)
    for c in (1.0, 1 / 384):
        r = 1 / np.sqrt(c)
        x = expmap0(rng.normal(size=(8, 5)) * 0.3 * r, c)
        y = expmap0(rng.normal(size=(8, 5)) * 0.3 * r, c)
        zero = np.zeros_like(x)
        assert np.allclose(mobius_add(x, zero, c), x, atol=1e-7)
        assert np.allclose(dist(x, x, c), 0.0, atol=1e-6)
        assert np.allclose(dist(x, y, c), dist(y, x, c), atol=1e-6)
        assert np.allclose(dist0(x, c), dist(zero, x, c), atol=1e-6)
        v = rng.normal(size=(8, 5)) * 0.5 * r
        assert np.allclose(logmap0(expmap0(v, c), c), v, atol=1e-6)
        # Triangle inequality on random triples.
        z = expmap0(rng.normal(size=(8, 5)) * 0.3 * r, c)
        assert np.all(dist(x, z, c) <= dist(x, y, c) + dist(y, z, c) + 1e-6)
        # Points nearer the boundary are farther from the origin than their Euclidean norm says.
        assert np.all(dist0(x, c) >= 2 * np.linalg.norm(x, axis=-1) - 1e-9)


def test_scaling() -> None:
    # c = 1 and c = 1/4: the ball of radius 2 is the unit ball scaled by 2, and distances scale by 2.
    rng = np.random.default_rng(1)
    x = rng.normal(size=(6, 3)) * 0.2
    y = rng.normal(size=(6, 3)) * 0.2
    assert np.allclose(dist(2 * x, 2 * y, 0.25), 2 * dist(x, y, 1.0), atol=1e-6)


if __name__ == "__main__":
    test_identities()
    test_scaling()
    print("poincare_ops: all self-tests passed")
