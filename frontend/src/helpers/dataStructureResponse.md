insomnia name:fintrack get account by accountId
url:http://localhost:5000/api/fintrack/account/${accountId}$?&user=${userId}
data samples per account type:
account type: bank, income_source, investment
{
	"status": 200,
	"message": "Account list successfully completed ",
	"data": {
		"rows": 1,
		"accountList": [
			{
				"account_type_name": "pocket_saving",
				"account_id": 1,
				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
				"account_name": "pocket 01",
				"account_type_id": 4,
				"currency_id": 1,
				"account_starting_amount": "0.00",
				"account_balance": "0.00",
				"account_start_date": "2025-06-27T20:32:05.087Z",
				"created_at": "2025-06-28T00:32:07.498Z",
				"updated_at": "2025-06-27T20:32:06.978Z"
			}
		]
	}
}

account_type=pocket_saving
{
	"status": 200,
	"message": "Account list successfully completed ",
	"data": {
		"rows": 1,
		"accountList": [
			{
				"account_id": 1,
				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
				"account_name": "pocket 01",
				"account_type_id": 4,
				"currency_id": 1,
				"account_starting_amount": "0.00",
				"account_balance": "0.00",
				"account_start_date": "2025-06-27T20:32:05.087Z",
				"created_at": "2025-06-28T00:32:07.498Z",
				"updated_at": "2025-06-27T20:32:06.978Z",
				"account_type_name": "pocket_saving",
				"currency_code": "usd",
				"target": "1234.00",
				"note": "first pocket saving to test.",
				"desired_date": "2025-06-28T00:31:07.858Z"
			}
		]
	}
}
//-------------------------------------
fintrack dashboardMovementTransactions
http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=expense&start=&end=&user=c109eb15-4139-43b4-b081-8fb9860588af

{
	"status": 200,
	"message": "1 transaction(s) found. Period between 2025-06-01 and 2025-07-02",
	"data": [
		{
			"movement_type_name": "expense",
			"account_id": 9,
			"account_name": "housing_must",
			"account_balance": "3.00",
			"budget": "550.00",
			"currency_code": "usd",
			"account_type_id": 5,
			"account_type_name": "category_budget",
			"category_name": "housing",
			"subcategory": "house 01",
			"category_nature_type_name": "must",
			"account_starting_amount": "0.00",
			"account_start_date": "2025-07-01T10:24:15.346Z",
			"description": "hose.Transaction: deposit. Received 3 usd in account \"housing_must (category_budget), from \"Bank Nuevo\" (bank). Date: 01/07/2025, 02:47",
			"transaction_actual_date": "2025-07-01T06:47:09.159Z",
			"amount": "3.00"
		}
	]
}

//-------------------------------------
fintrack dashboardMovementTransactions
http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=expense&start=&end=&user=c109eb15-4139-43b4-b081-8fb9860588af


