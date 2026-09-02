import unittest
from app.lib.ssrf_validator import validate_webhook_url, is_ip_private_or_reserved

class TestSSRFValidator(unittest.TestCase):

    def test_private_ips_detection(self):
        self.assertTrue(is_ip_private_or_reserved("127.0.0.1"))
        self.assertTrue(is_ip_private_or_reserved("10.0.0.1"))
        self.assertTrue(is_ip_private_or_reserved("192.168.1.1"))
        self.assertTrue(is_ip_private_or_reserved("172.16.0.1"))
        self.assertTrue(is_ip_private_or_reserved("169.254.169.254"))
        self.assertTrue(is_ip_private_or_reserved("::1"))
        # IP pública de Cloudflare DNS
        self.assertFalse(is_ip_private_or_reserved("1.1.1.1"))

    def test_rejected_urls(self):
        rejected_cases = [
            ("http://crm.example.com", "protocolo HTTPS"),
            ("https://localhost/webhook", "direcciones locales"),
            ("https://127.0.0.1/webhook", "direcciones locales"),
            ("https://10.0.0.5/api", "red privada"),
            ("https://192.168.1.50/api", "red privada"),
            ("ftp://example.com", "protocolo HTTPS"),
            ("", "no puede estar vacía"),
            ("not-a-valid-url", "protocolo HTTPS"),
        ]
        for url, expected_substring in rejected_cases:
            is_valid, msg = validate_webhook_url(url)
            self.assertFalse(is_valid, f"La URL '{url}' debería ser rechazada")
            self.assertIn(expected_substring.lower(), msg.lower())

    def test_allowed_public_url(self):
        is_valid, msg = validate_webhook_url("https://httpbin.org/post")
        self.assertTrue(is_valid, f"Error en URL pública válida: {msg}")

if __name__ == "__main__":
    unittest.main()
