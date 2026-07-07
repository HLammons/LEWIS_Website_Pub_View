import numpy as np
from typing import Union, List

SIMPLE8B_SELECTOR_BITS = 4

# Selector configurations: (num_values, bits_per_value)
SELECTOR_CONFIG = [
    (240, 0),  # selector 0
    (120, 0),  # selector 1
    (60, 1),   # selector 2
    (30, 2),   # selector 3
    (20, 3),   # selector 4
    (15, 4),   # selector 5
    (12, 5),   # selector 6
    (10, 6),   # selector 7
    (8, 7),    # selector 8
    (7, 8),    # selector 9
    (6, 10),   # selector 10
    (5, 12),   # selector 11
    (4, 15),   # selector 12
    (3, 20),   # selector 13 
    (2, 30),   # selector 14
    (1, 60),   # selector 15
]


def get_selector(word: int) -> int:
    """Extract selector from encoded word."""
    return word >> (64 - SIMPLE8B_SELECTOR_BITS)


def unpack_word(word: int, num_values: int, bits_per_value: int) -> List[int]:
    """Unpack values from a single 64-bit word."""
    if bits_per_value == 0:
        return [0] * num_values
    
    mask = (1 << bits_per_value) - 1
    values = []
    
    for i in range(num_values):
        shift = 64 - SIMPLE8B_SELECTOR_BITS - bits_per_value - (i * bits_per_value)
        value = (word >> shift) & mask
        values.append(value)
    
    return values


def simple8b_decode(compressed: Union[np.ndarray, List[int]], output_length: int) -> np.ndarray:
    """
    Decode Simple8b compressed data.
    
    Args:
        compressed: Array of uint64 compressed words
        output_length: Expected number of values to decode
    
    Returns:
        numpy array of decoded uint64 values
    """
    if isinstance(compressed, list):
        compressed = np.array(compressed, dtype=np.uint64)
    
    output = []
    word_idx = 0
    
    while len(output) < output_length and word_idx < len(compressed):
        word = int(compressed[word_idx])
        selector = get_selector(word)
        
        num_values, bits_per_value = SELECTOR_CONFIG[selector]
        
        values_needed = min(num_values, output_length - len(output))
        decoded = unpack_word(word, values_needed, bits_per_value)
        
        output.extend(decoded)
        word_idx += 1
    
    return np.array(output[:output_length], dtype=np.uint64)


def zigzag_decode(data: np.ndarray) -> np.ndarray:
    """
    ZigZag decode signed integers.
    Converts unsigned back to signed.
    """
    if data.dtype == np.int16:
        unsigned = data.astype(np.uint16)
        return ((unsigned >> 1) ^ -(unsigned & 1)).astype(np.int16)
    
    elif data.dtype == np.int32:
        unsigned = data.astype(np.uint32)
        return ((unsigned >> 1) ^ -(unsigned & 1)).astype(np.int32)
    
    elif data.dtype == np.int64:
        unsigned = data.astype(np.uint64)
        return ((unsigned >> 1) ^ -(unsigned & 1)).astype(np.int64)
    
    else:
        raise ValueError(f"Unsupported dtype for zigzag: {data.dtype}")


def delta_decode(data: np.ndarray) -> np.ndarray:
    """
    Delta decode: convert differences back to absolute values.
    """
    return np.cumsum(data)

def decompress_int16_array(compressed: Union[np.ndarray, List[int]], 
                          original_size: int) -> np.ndarray:
    """
    Decompress int16 array that was compressed with delta+zigzag+simple8b.
    
    Args:
        compressed: Array of uint64 compressed words
        original_size: Original number of int16 values
    
    Returns:
        numpy array of decompressed int16 values
    """

    uint64_data = simple8b_decode(compressed, original_size)
    
    int16_data = uint64_data.astype(np.int16)
    
    int16_data = zigzag_decode(int16_data)
    
    # int16_data = delta_decode(int16_data)

    # int16_data = delta_decode(int16_data)
    
    return int16_data

def decode_uint64_array(compressed: Union[np.ndarray, List[int]], 
                       output_length: int) -> np.ndarray:
    """
    Decode uint64 array (Simple8b only, no delta/zigzag).
    
    Args:
        compressed: Array of uint64 compressed words
        output_length: Expected number of values
    
    Returns:
        numpy array of decoded uint64 values
    """
    return simple8b_decode(compressed, output_length)


if __name__ == "__main__":
    print("Test 1: uint64 decode")
    compressed = np.array([0x2AAAAAAAAAAAAA00], dtype=np.uint64)
    decoded = decode_uint64_array(compressed, 60)
    print(f"Decoded {len(decoded)} values")
    print(f"First 10: {decoded[:10]}")
    
    print("\nTest 2: int16 with delta+zigzag decode")
    compressed_int16 = np.array([0x2000000000000000], dtype=np.uint64)
    decoded_int16 = decompress_int16_array(compressed_int16, 60)
    print(f"Decoded {len(decoded_int16)} values")
    print(f"First 10: {decoded_int16[:10]}")