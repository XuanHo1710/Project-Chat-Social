import unittest

from app.services.chunking_service import chunk_text


class ChunkTextTests(unittest.TestCase):
    def assert_bounded(self, text: str, size: int = 500, overlap: int = 100):
        chunks = chunk_text(text, max_chunk_size=size, chunk_overlap=overlap)
        self.assertTrue(chunks)
        self.assertTrue(all(0 < len(chunk) <= size for chunk in chunks))

    def test_sentence_overlap_always_advances(self):
        self.assert_bounded(("a" * 350 + ". " + "b" * 350 + ". ") * 20)

    def test_unbroken_token_is_hard_bounded(self):
        self.assert_bounded("x" * 5000)

    def test_overlap_larger_than_chunk_is_clamped(self):
        self.assert_bounded("word " * 1000, size=100, overlap=1000)


if __name__ == "__main__":
    unittest.main()
