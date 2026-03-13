import pandas as pd
import time

class DataStreamer:

    def __init__(self, file):

        self.df = pd.read_csv(file)

        self.index = 0

    def get_next(self):

        if self.index >= len(self.df):
            self.index = 0

        row = self.df.sample(1).iloc[0].to_dict()
        self.index += 1

        time.sleep(0.2)

        return row