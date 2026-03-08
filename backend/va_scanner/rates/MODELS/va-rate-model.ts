export interface VaRateYear {
  year: number;
  ratings: {
    [percentage: string]: {
      veteran?: number;
      veteran_spouse?: number;
      veteran_child?: number;
      veteran_spouse_child?: number;
      veteran_one_parent?: number;
      veteran_two_parents?: number;
      additional_child?: number;
    };
  };
}

export interface VaRateManifest {
  created: string;
  updated: string;
  years: number[];
  version: string;
}

