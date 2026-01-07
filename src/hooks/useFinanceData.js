import useLocalStorage from './useLocalStorage';
import { generateUUID } from '../utils/uuid';

const DEFAULT_DATA = {
    cards: [
        { id: 1, name: 'Card A (Main Card)', limit: 15000, money: 2000, debt: 3500 },
        { id: 2, name: 'Card B (Backup)', limit: 5000, money: 0, debt: 0 },
    ],
    funds: [
        { id: 101, name: 'Salary Account', amount: 8500 },
        { id: 102, name: 'Savings Account', amount: 12000 },
        { id: 103, name: 'Wallet / Cash', amount: 450 }
    ],
    others: [
        { id: 201, name: 'Rent', amount: 0 },
        { id: 202, name: 'Dorm / Tuition', amount: 0 }
    ]
};

export default function useFinanceData() {
    const [cards, setCards] = useLocalStorage('finance_cards_v2', DEFAULT_DATA.cards);
    const [funds, setFunds] = useLocalStorage('finance_funds_v2', DEFAULT_DATA.funds);
    const [others, setOthers] = useLocalStorage('finance_others_v2', DEFAULT_DATA.others);

    // CRUD for Cards
    const addCard = () => {
        setCards([...cards, { id: generateUUID(), name: 'New Card', limit: 0, money: 0, debt: 0 }]);
    };

    const updateCard = (id, field, value) => {
        setCards(cards.map(card =>
            card.id === id ? { ...card, [field]: value } : card
        ));
    };

    const removeCard = (id) => {
        if (window.confirm('Delete this card?')) {
            setCards(cards.filter(card => card.id !== id));
        }
    };

    // CRUD for Funds
    const addFund = () => {
        setFunds([...funds, { id: generateUUID(), name: 'New Account', amount: 0 }]);
    };

    const updateFund = (id, field, value) => {
        setFunds(funds.map(fund =>
            fund.id === id ? { ...fund, [field]: value } : fund
        ));
    };

    const removeFund = (id) => {
        if (window.confirm('Delete this account?')) {
            setFunds(funds.filter(fund => fund.id !== id));
        }
    };

    // CRUD for Others
    const addOther = () => {
        setOthers([...others, { id: generateUUID(), name: 'New Payment', amount: 0 }]);
    };

    const updateOther = (id, field, value) => {
        setOthers(others.map(other =>
            other.id === id ? { ...other, [field]: value } : other
        ));
    };

    const removeOther = (id) => {
        if (window.confirm('Delete this payment?')) {
            setOthers(others.filter(other => other.id !== id));
        }
    };

    // Calculations
    const totalLimit = cards.reduce((sum, c) => sum + (parseFloat(c.limit) || 0), 0);
    const totalCardDebt = cards.reduce((sum, c) => sum + (parseFloat(c.debt) || 0), 0);
    const totalOtherDebt = others.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    const totalDebt = totalCardDebt + totalOtherDebt;

    const totalFundCash = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    const totalCardMoney = cards.reduce((sum, c) => sum + (parseFloat(c.money) || 0), 0);
    const totalAssets = totalFundCash + totalCardMoney;

    const overallNet = totalAssets - totalDebt;
    const ccNet = cards.reduce((sum, c) => sum + ((parseFloat(c.money) || 0) - (parseFloat(c.debt) || 0)), 0);

    return {
        cards, funds, others,
        addCard, updateCard, removeCard,
        addFund, updateFund, removeFund,
        addOther, updateOther, removeOther,
        totals: {
            totalLimit,
            totalDebt,
            totalAssets,
            overallNet,
            ccNet
        }
    };
}
