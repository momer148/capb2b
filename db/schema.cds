namespace capb2b;

entity Products {
  key ID : Integer;
  name : String(100);
  description : String(500);
  price : Decimal(10,2);
  categoryID : Integer;
  supplierID : Integer;
  stock : Integer;
  createdAt : Timestamp;
  modifiedAt : Timestamp;
}

entity Categories {
  key ID : Integer;
  name : String(100);
  description : String(500);
}

entity Suppliers {
  key ID : Integer;
  name : String(100);
  email : String(100);
  phone : String(20);
  address : String(200);
}

entity Orders {
  key ID : Integer;
  customerID : Integer;
  orderDate : Timestamp;
  totalAmount : Decimal(10,2);
  status : String(20);
}

entity OrderItems {
  key ID : Integer;
  orderID : Integer;
  productID : Integer;
  quantity : Integer;
  price : Decimal(10,2);
}

entity Customers {
  key ID : Integer;
  name : String(100);
  email : String(100);
  phone : String(20);
  address : String(200);
  creditLimit : Decimal(10,2);
}
