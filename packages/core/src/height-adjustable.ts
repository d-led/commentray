export interface WithHeight {
  height: number;
}

export interface Identifiable {
  id: string;
}

export interface HeightAdjustable extends Identifiable, WithHeight {
  bufferBelow: number;
}
