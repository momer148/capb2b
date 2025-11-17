using capb2b from '../db/schema';

service CatalogService {
  entity Products as projection on capb2b.Products;
  entity Categories as projection on capb2b.Categories;
  entity Suppliers as projection on capb2b.Suppliers;
  entity Orders as projection on capb2b.Orders;
  entity OrderItems as projection on capb2b.OrderItems;
  entity Customers as projection on capb2b.Customers;
  
  // Custom actions
  action processOrder(orderID: Integer) returns String;
  action generateReport() returns String;
  function getProductDetails(productID: Integer) returns String;
  function getOrderSummary(customerID: Integer) returns String;
}
