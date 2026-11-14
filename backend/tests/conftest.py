import pytest

from app.settings import load_config
from app.state import Mission


@pytest.fixture(scope="session")
def cfg():
    return load_config()


@pytest.fixture
def mission(cfg):
    return Mission(cfg, seed=1)


def run(m: Mission, seconds: float, step: float = 5.0) -> None:
    for _ in range(int(seconds / step)):
        m.step(step)
