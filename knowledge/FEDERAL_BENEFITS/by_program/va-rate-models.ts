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

export interface VaSmcYear {
  year: number;
  smc: {
    [code: string]: number | null;
  };
}

export interface VaSmcDependentsYear {
  year: number;
  smc_dependents: {
    [code: string]: {
      veteran_spouse?: number | null;
      veteran_child?: number | null;
      veteran_spouse_child?: number | null;
      additional_child?: number | null;
      attendant?: number | null;
    };
  };
}

export interface AncillaryEligibility {
  [benefit: string]: {
    requires: string[];
    one_time_payment?: boolean;
    annual_payment?: boolean;
  };
}

export interface VaRateManifest {
  created: string;
  updated: string;
  years: number[];
  includes_smc: boolean;
  includes_ancillary: boolean;
  version: string;
}

