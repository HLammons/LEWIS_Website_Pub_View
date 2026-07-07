from queue import Queue
from core.task_puller import TaskPuller

class MonitorQueue:
    _instance = None
    _task_q = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._task_q = Queue(maxsize=100)
        return cls._instance
    
    def put(self, item):
        self.validate_item(item)
        self._task_q.put(item)

    def get(self):
        return self._task_q.get()
    
    def is_empty(self):
        return self._task_q.empty()

    def validate_item(self, item):
        if not isinstance(item, list):
            raise Exception('[MonitorQueue][validate item] Item is not a list')

        if len(item) != 3:
            raise Exception('[MonitorQueue][validate item] incorrect format')
        
        if None in item:
            raise Exception('[MonitorQueue][validate item] one of the items was null')
            


