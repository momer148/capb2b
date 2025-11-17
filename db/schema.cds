namespace capb2b;

entity Products {
  key ID : Integer;
  name : String(100);
  description : String(500);
  price : Decimal(10,2);
  categoryID : Integer; // Index for JOIN performance
  supplierID : Integer; // Index for JOIN performance
  stock : Integer;
  createdAt : Timestamp;
  modifiedAt : Timestamp;
}

// Annotations for database indexes to improve query performance
annotate Products with {
  categoryID @assert.integrity;
  supplierID @assert.integrity;
};

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
  customerID : Integer; // Index for filtering by customer
  orderDate : Timestamp; // Index for sorting by date
  totalAmount : Decimal(10,2);
  status : String(20);
}

// Annotations for database indexes
annotate Orders with {
  customerID @assert.integrity;
  orderDate; // Create index for sorting
};

entity OrderItems {
  key ID : Integer;
  orderID : Integer; // Index for JOIN with Orders
  productID : Integer; // Index for JOIN with Products
  quantity : Integer;
  price : Decimal(10,2);
}

// Annotations for database indexes
annotate OrderItems with {
  orderID @assert.integrity;
  productID @assert.integrity;
};

entity Customers {
  key ID : Integer;
  name : String(100);
  email : String(100);
  phone : String(20);
  address : String(200);
  creditLimit : Decimal(10,2);
}
