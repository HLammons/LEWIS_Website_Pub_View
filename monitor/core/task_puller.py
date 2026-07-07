from insert import insert
import threading

class TaskPuller:
    _instance = None
    _task_q = None
    _tasks = {
        'insert': insert.insert_data
    }

    def __new__(cls, task_q):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._task_q = task_q
            threading.Thread(target=cls._instance.worker, daemon=True).start()
        return cls._instance

    def worker(self):
        while True:
            task = self._task_q.get()
            if task[-1] not in self._tasks:
                raise Exception('[MONITOR][task puller] task pulled from queue did not have correct task type at [0]')
            task_obj = task.pop(-1)
            print(f'[MONITOR][Task Puller] from worker: insert for coreid {task[0]}, sensor_name {task[1]}')
            self._tasks[task_obj](task)


