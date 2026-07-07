import multiprocessing
import os

counter = multiprocessing.Value('i', 0)
counter_lock = counter.get_lock()
container_urls = ['filter-service-1', 'filter-service-2', 'filter-service-3']

def get_filter_container_url():
    with counter_lock:
        idx = counter.value % 3
        counter.value += 1
    print(f'[FILTER CONTAINER SELECTOR][get] filter url: {container_urls[idx]} passed to PID: {os.getpid()}')
    return container_urls[idx]