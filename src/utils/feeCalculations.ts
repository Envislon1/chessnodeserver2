
export const calculateFee = (amount: number): number => {
  return Math.ceil(amount * 0.01); // 1% fee, rounded up
};

export const calculateTotalWithFee = (amount: number): number => {
  return amount + calculateFee(amount);
};

export const calculateAmountAfterFee = (amount: number): number => {
  return amount - calculateFee(amount);
};
