import unittest
from app.lib.crypto import (
    encrypt_token,
    decrypt_token,
    calculate_hmac_sha256,
    generate_secure_secret,
    get_key_bytes
)

class TestCrypto(unittest.TestCase):

    def setUp(self):
        self.key = "super_secure_test_key_32_bytes_iqmx"
        self.sample_token = "EAABxxxxxxxxxxxxxxxxxxxxxxxxx"

    def test_key_normalization(self):
        kb = get_key_bytes(self.key)
        self.assertEqual(len(kb), 32)

    def test_encrypt_decrypt_aes_gcm(self):
        encrypted = encrypt_token(self.sample_token, self.key)
        self.assertNotEqual(encrypted, self.sample_token)
        self.assertTrue(len(encrypted) > 20)

        decrypted = decrypt_token(encrypted, self.key)
        self.assertEqual(decrypted, self.sample_token)

    def test_decrypt_tampered_fails(self):
        encrypted = encrypt_token(self.sample_token, self.key)
        # Modificar el ciphertext en base64
        tampered = encrypted[:-4] + "AAAA"
        with self.assertRaises(Exception):
            decrypt_token(tampered, self.key)

    def test_hmac_sha256(self):
        secret = "my_signing_key_123"
        payload = b'{"event":"message","from":"521314"}'
        sig = calculate_hmac_sha256(secret, payload)
        self.assertEqual(len(sig), 64)
        # Consistencia
        sig2 = calculate_hmac_sha256(secret, payload)
        self.assertEqual(sig, sig2)

    def test_generate_secure_secret(self):
        secret1 = generate_secure_secret(32)
        secret2 = generate_secure_secret(32)
        self.assertEqual(len(secret1), 64)  # 32 bytes hex = 64 chars
        self.assertNotEqual(secret1, secret2)

if __name__ == "__main__":
    unittest.main()
