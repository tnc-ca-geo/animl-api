declare namespace ML {
  interface Detection {
    mlModel: string;
    mlModelVersion: string;
    bbox: BBox;
    conf?: number;
    labelId: string;
  }

  interface Image {
    _id: string;
    batchId: string;
    imageBytes: number;
  }

  interface ModelSource {
    _id: string;
    version: string;
  }

  interface Cat {
    _id: string;
    disabled: boolean;
    confThreshold: number;
  }

  type BBox = [number, number, number, number];

  interface ModelInterfaceParams {
    modelSource: ModelSource;
    catConfig: Cat[];
    image: Image;
    label: Label;
    config: Record<any, any>; // TODO: Find true type for `config`
  }

  interface InferenceFunction {
    (params: ModelInterfaceParams): Promise<Detection[]>;
  }
}
