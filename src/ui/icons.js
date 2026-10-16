import {
    Home, ShoppingCart, Utensils, Coffee, Sparkles, Repeat, Bus, Shirt, Headphones, Sofa, Plane,
    Heart, Percent, MoreHorizontal, Briefcase, Plus, Landmark, Banknote, Wallet, CreditCard, PiggyBank,
    Gift, Book, Gamepad2, Dumbbell, Smartphone,
} from 'lucide-react';

export const CATEGORY_ICONS = {
    home: Home, cart: ShoppingCart, utensils: Utensils, coffee: Coffee, sparkles: Sparkles,
    repeat: Repeat, bus: Bus, shirt: Shirt, headphones: Headphones, sofa: Sofa, plane: Plane,
    heart: Heart, percent: Percent, dots: MoreHorizontal, briefcase: Briefcase, plus: Plus,
    gift: Gift, book: Book, game: Gamepad2, gym: Dumbbell, phone: Smartphone,
};

export const categoryIcon = (category) => CATEGORY_ICONS[category?.icon] || MoreHorizontal;

export const ACCOUNT_ICONS = { bank: Landmark, cash: Banknote, ewallet: Wallet, credit: CreditCard, investment: PiggyBank };
export const accountIcon = (account) => ACCOUNT_ICONS[account?.kind] || Landmark;
