CATALOG TABLES INFO
movement_types
"movement_type_id" "movement_type_name"
1 "expense"
2 "income"
3 "investment"
4 "debt"
5 "pocket"
6 "transfer"
7 "receive"
8 "account-opening"

transaction_types
"transaction_type_id" "transaction_type_name"
1 "withdraw"
2 "deposit"
3 "lend"
4 "borrow"
5 "account-opening"

"account_type_id" "account_type_name"
1 "bank"
2 "investment"
3 "debtor"
4 "pocket_saving"
5 "category_budget"
6 "income_source"

"category_nature_type_id"	"category_nature_type_name"
1	"must"
2	"need"
3	"other"
4	"want"

//--------------------
select table_name
FROM information_schema.tables
WHERE table_schema = 'public'
//--------------------
"table_name"
"transactions"
"users"
"income_source_accounts"
"category_budget_accounts"
"app_initialization"
"user_roles"
"transaction_types"
"movement_types"
"category_nature_types"
"debtor_accounts"
"refresh_tokens"
"account_types"
"currencies"
"user_accounts"
"pocket_saving_accounts"
