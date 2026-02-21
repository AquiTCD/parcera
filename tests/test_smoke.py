def test_smoke():
    assert True

def test_imports():
    from src.core.factory import ParceraComponentFactory
    assert ParceraComponentFactory is not None
