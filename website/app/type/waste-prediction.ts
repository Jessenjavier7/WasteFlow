type WastePrediction = {
  prediction: string;
  confidence: number;
  top_predictions: {
    class: string;
    confidence: number;
  }[];
};
