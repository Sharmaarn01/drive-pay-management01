
export enum PaymentPreference {
  ALL_BATTA = 'ALL_BATTA',
  ALL_SALARY = 'ALL_SALARY',
  SPLIT = 'SPLIT'
}

export interface Driver {
  id: string;
  name: string;
  vehicleId: string;
  preference: PaymentPreference;
  avatar?: string;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  battaRate: number;
  salaryRate: number;
}

export interface Trip {
  id: string;
  driverId: string;
  routeId: string;
  timestamp: number;
  vehicleId: string;
  settledWeekly: boolean;
  settledMonthly: boolean;
}

export interface Settlement {
  id: string;
  driverId: string;
  type: 'WEEKLY' | 'MONTHLY';
  amount: number;
  timestamp: number;
  tripIds: string[];
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export enum AspectRatio {
  R1_1 = '1:1',
  R2_3 = '2:3',
  R3_2 = '3:2',
  R3_4 = '3:4',
  R4_3 = '4:3',
  R9_16 = '9:16',
  R16_9 = '16:9',
  R21_9 = '21:9'
}
