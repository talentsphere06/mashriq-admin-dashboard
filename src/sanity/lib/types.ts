export interface Order {
  _id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zipCode: string;
  total: number;
  discount: number;
  orderDate: string;
  status: string | null;
  cartItems: {
    _id?: string;
    _key?: string;
    name: string;
    image?: {
      asset: {
        _id?: string;
        url?: string;
      };
    };
    quantity: number;
    price: number;
  }[];
}


export interface Product {
  _id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  sizes: string[];
  description?: string;
  variants: Variant[];
}

export interface Variant {
  _type?: string;
  _key?: string;
  color?: string;
  images?: ProductImage[];
}

export interface ProductImage {
  _type: string;
  _key?: string;
  asset: {
    _type: string;
    _ref: string;
    _id?: string;
    url?: string;
  };
}
