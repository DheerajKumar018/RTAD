from river.drift import ADWIN

class DriftDetector:

    def __init__(self):

        self.adwin = ADWIN()

    def update(self, score):

        self.adwin.update(score)

        if self.adwin.drift_detected:
            return True

        return False