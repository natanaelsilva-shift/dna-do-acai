export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

export const formatOptionPrice = (value: number) =>
  value === 0 ? "Incluso" : `+ ${formatCurrency(value)}`;
