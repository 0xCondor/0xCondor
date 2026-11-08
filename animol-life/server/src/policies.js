// Politiche commerciali: unica fonte di verità per ordini, assistente e agente vocale.
export const COUPONS = {
  ANIMOL10: { percent: 10, description: 'Sconto del 10% sul totale prodotti' },
  CUCCIOLO5: { percent: 5, description: 'Sconto del 5% sul totale prodotti' },
};

export const PLUS = {
  monthly: { amountCents: 599, label: '5,99 €/mese', interval: 'month' },
  yearly: { amountCents: 4990, label: '49,90 €/anno', interval: 'year' },
  trialDays: 14,
  discountPercent: 5,
};

export const POLICIES = {
  shipping:
    'Spedizione gratuita per ordini da 49 € in su (calcolati dopo gli sconti); sotto i 49 € la spedizione costa 4,90 €. ' +
    'Consegna in Italia in 24-72 ore lavorative dalla spedizione. I membri Animol Plus hanno sempre la spedizione gratuita.',
  returns:
    'Diritto di recesso di 14 giorni dalla consegna, senza dover indicare il motivo (Codice del Consumo, art. 52 e seguenti). ' +
    'Il rimborso avviene entro 14 giorni dalla ricezione della comunicazione di recesso. I prodotti alimentari aperti o sigillati ' +
    'e poi aperti per motivi igienici possono essere esclusi. Per avviare un reso scrivi a assistenza o usa la pagina Resi.',
  coupons:
    'Coupon attivi: ANIMOL10 (-10% sul totale prodotti) e CUCCIOLO5 (-5% sul totale prodotti). Un solo coupon per ordine.',
  plus:
    'Animol Plus costa 5,99 €/mese oppure 49,90 €/anno, con 14 giorni di prova gratuita. Include spedizione sempre gratuita, ' +
    'uno sconto extra del 5% su ogni ordine e l\'accesso alle dirette private con esperti. Si può disdire in qualsiasi momento.',
  payment: 'Pagamenti con carta, PayPal o contrassegno (dove disponibile), senza alcun costo aggiuntivo per il contrassegno. I prezzi includono l\'IVA.',
  contact: 'Assistenza umana: dal lunedì al venerdì 9-18, via email o telefono (chiedi di parlare con un operatore).',
};

export function formatEuro(cents) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

/**
 * Nessun supplemento per il metodo di pagamento (contrassegno incluso): vietato dall'art. 62 Cod. Consumo.
 * Per questo computeTotals non riceve né considera il metodo di pagamento.
 *
 * Calcola i totali in centesimi. Gli sconti (coupon + Plus) si applicano al subtotale prodotti;
 * la spedizione è gratuita sopra soglia (dopo gli sconti) o per i membri Plus.
 */
export function computeTotals({ lines, couponCode, isPlus, shipping }) {
  const subtotalCents = lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  const coupon = couponCode ? COUPONS[couponCode] : null;
  const couponPercent = coupon ? coupon.percent : 0;
  const plusPercent = isPlus ? PLUS.discountPercent : 0;
  const couponDiscountCents = Math.round((subtotalCents * couponPercent) / 100);
  const plusDiscountCents = Math.round((subtotalCents * plusPercent) / 100);
  const discountedCents = subtotalCents - couponDiscountCents - plusDiscountCents;
  const shippingCents = isPlus || discountedCents >= shipping.freeThresholdCents || lines.length === 0 ? 0 : shipping.costCents;
  return {
    subtotalCents,
    couponDiscountCents,
    plusDiscountCents,
    shippingCents,
    totalCents: discountedCents + shippingCents,
  };
}
