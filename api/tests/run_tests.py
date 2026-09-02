import os
import sys
import unittest

# Asegurar path de api
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def run_all_tests():
    """
    Descubre y ejecuta todos los tests de la suite en el directorio tests/.
    """
    loader = unittest.TestLoader()
    start_dir = os.path.dirname(__file__)
    suite = loader.discover(start_dir, pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print(f"Total pruebas ejecutadas: {result.testsRun}")
    print(f"Éxitos: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Fallos: {len(result.failures)}")
    print(f"Errores: {len(result.errors)}")
    print("=" * 60)

    if result.wasSuccessful():
        print("✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE.")
        sys.exit(0)
    else:
        print("❌ ALGUNAS PRUEBAS FALLARON.")
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
