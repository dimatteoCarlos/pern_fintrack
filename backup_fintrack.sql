--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_types (
    account_type_id integer NOT NULL,
    account_type_name character varying(50) NOT NULL
);


--
-- Name: app_initialization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_initialization (
    id integer NOT NULL,
    tables_created boolean DEFAULT false NOT NULL,
    initialized_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_initialization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_initialization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_initialization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_initialization_id_seq OWNED BY public.app_initialization.id;


--
-- Name: category_budget_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_budget_accounts (
    account_id integer NOT NULL,
    category_name character varying(50) NOT NULL,
    category_nature_type_id integer,
    subcategory character varying(25),
    budget numeric(15,2),
    currency_id integer,
    account_start_date timestamp with time zone NOT NULL
);


--
-- Name: category_nature_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_nature_types (
    category_nature_type_id integer NOT NULL,
    category_nature_type_name character varying(15) NOT NULL
);


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencies (
    currency_id integer NOT NULL,
    currency_code character varying(3) NOT NULL,
    currency_name character varying(25) NOT NULL
);


--
-- Name: debtor_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debtor_accounts (
    account_id integer NOT NULL,
    value numeric(15,2),
    currency_id integer,
    debtor_name character varying(25),
    debtor_lastname character varying(25),
    selected_account_id integer,
    selected_account_name character varying(50),
    account_start_date timestamp with time zone NOT NULL
);


--
-- Name: income_source_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_source_accounts (
    account_id integer NOT NULL,
    account_starting_amount numeric(15,2),
    currency_id integer,
    account_start_date timestamp with time zone NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    filename text NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: movement_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movement_types (
    movement_type_id integer NOT NULL,
    movement_type_name character varying(50) NOT NULL
);


--
-- Name: pocket_saving_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pocket_saving_accounts (
    account_id integer NOT NULL,
    target numeric(15,2),
    currency_id integer,
    note character varying(155),
    desired_date timestamp with time zone NOT NULL,
    account_start_date timestamp with time zone NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    token_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expiration_date timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    user_agent text,
    ip_address text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: transaction_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_types (
    transaction_type_id integer NOT NULL,
    transaction_type_name character varying(50) NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    transaction_id integer NOT NULL,
    user_id uuid NOT NULL,
    description text,
    amount numeric(15,2) NOT NULL,
    movement_type_id integer NOT NULL,
    transaction_type_id integer NOT NULL,
    currency_id integer NOT NULL,
    account_id integer NOT NULL,
    account_balance_after_tr numeric(15,2) DEFAULT 0.00 NOT NULL,
    source_account_id integer,
    destination_account_id integer,
    status text NOT NULL,
    transaction_actual_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_transaction_id_seq OWNED BY public.transactions.transaction_id;


--
-- Name: user_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_accounts (
    account_id integer NOT NULL,
    user_id uuid NOT NULL,
    account_name character varying(50) NOT NULL,
    account_type_id integer,
    currency_id integer NOT NULL,
    account_starting_amount numeric(15,2) NOT NULL,
    account_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    note character varying(155),
    account_start_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: user_accounts_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_accounts_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_accounts_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_accounts_account_id_seq OWNED BY public.user_accounts.account_id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_role_id integer NOT NULL,
    user_role_name character varying(15) NOT NULL,
    CONSTRAINT user_roles_user_role_name_check CHECK (((user_role_name)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'super_admin'::character varying, 'system_admin'::character varying])::text[])))
);


--
-- Name: user_roles_user_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_user_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_user_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_user_role_id_seq OWNED BY public.user_roles.user_role_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    user_firstname character varying(25) NOT NULL,
    user_lastname character varying(25) NOT NULL,
    user_contact character varying(25),
    password_hashed character varying(255) NOT NULL,
    currency_id integer,
    google_id character varying(255),
    display_name character varying(255),
    auth_method character varying(50) DEFAULT 'password'::character varying,
    user_role_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: app_initialization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_initialization ALTER COLUMN id SET DEFAULT nextval('public.app_initialization_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.transactions_transaction_id_seq'::regclass);


--
-- Name: user_accounts account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_accounts ALTER COLUMN account_id SET DEFAULT nextval('public.user_accounts_account_id_seq'::regclass);


--
-- Name: user_roles user_role_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN user_role_id SET DEFAULT nextval('public.user_roles_user_role_id_seq'::regclass);


--
-- Data for Name: account_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_types (account_type_id, account_type_name) FROM stdin;
1	bank
2	investment
3	debtor
4	pocket_saving
5	category_budget
6	income_source
7	cash
\.


--
-- Data for Name: app_initialization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_initialization (id, tables_created, initialized_at, updated_at) FROM stdin;
1	t	2026-04-12 19:47:13.545985-03	2026-04-12 19:47:13.545985-03
\.


--
-- Data for Name: category_budget_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category_budget_accounts (account_id, category_name, category_nature_type_id, subcategory, budget, currency_id, account_start_date) FROM stdin;
4	category	1	Test	407.00	\N	2026-04-16 14:20:06.533-03
\.


--
-- Data for Name: category_nature_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category_nature_types (category_nature_type_id, category_nature_type_name) FROM stdin;
1	must
2	need
3	other
4	want
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.currencies (currency_id, currency_code, currency_name) FROM stdin;
1	usd	US Dollar
2	eur	Euro
3	cop	Pesos col
\.


--
-- Data for Name: debtor_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.debtor_accounts (account_id, value, currency_id, debtor_name, debtor_lastname, selected_account_id, selected_account_name, account_start_date) FROM stdin;
3	-2.00	1	Debtor	Test	\N	test01	2026-04-16 09:37:13.126-03
\.


--
-- Data for Name: income_source_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.income_source_accounts (account_id, account_starting_amount, currency_id, account_start_date) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, filename, executed_at) FROM stdin;
1	001_initial_migration.sql	2026-04-12 19:07:40.624235-03
2	002_accounts.sql	2026-04-12 19:07:40.652166-03
3	003_transactions.sql	2026-04-12 19:07:40.660978-03
4	004_auth.sql	2026-04-12 19:07:40.669508-03
5	005_base_catalogs.sql	2026-04-12 19:07:40.679811-03
\.


--
-- Data for Name: movement_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movement_types (movement_type_id, movement_type_name) FROM stdin;
1	expense
2	income
3	investment
4	debt
5	pocket
6	transfer
7	receive
8	account-opening
9	pnl
\.


--
-- Data for Name: pocket_saving_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pocket_saving_accounts (account_id, target, currency_id, note, desired_date, account_start_date) FROM stdin;
7	1500.00	\N	nota de test ..............	2026-04-17 15:07:15-03	2026-04-16 15:08:26.142-03
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (token_id, user_id, token, expiration_date, revoked, user_agent, ip_address, created_at, updated_at) FROM stdin;
6f4db99d-cc98-482d-a5bb-30f14566f6fa	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZDZjYjNmYy1kZjNmLTQ5YjMtODc5MS03MDE2MGUzM2MxZjAiLCJ0eXBlIjoicmVmcmVzaF90b2tlbiIsImlhdCI6MTc3NjYyNDM5MywiZXhwIjoxNzc3MzkzMzUzLCJpc3MiOiJmaW50cmFjayJ9.0qrSP-20GYir_-tTdg3ZkSLE_tVx9AQCY94Pcuh00zg	2026-04-26 15:46:33.977-03	t	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	127.0.0.1	2026-04-19 15:46:33.894358-03	2026-04-19 15:46:33.894358-03
\.


--
-- Data for Name: transaction_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transaction_types (transaction_type_id, transaction_type_name) FROM stdin;
1	withdraw
2	deposit
3	lend
4	borrow
5	account-opening
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (transaction_id, user_id, description, amount, movement_type_id, transaction_type_id, currency_id, account_id, account_balance_after_tr, source_account_id, destination_account_id, status, transaction_actual_date, created_at, updated_at) FROM stdin;
5	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: account-opening. Account: category/Test/must (category_budget). Initial-(account-opening). Amount: 0 usd.  Date:16/04/2026, 12:20	0.00	8	5	1	4	0.00	4	4	complete	2026-04-16 14:20:06.561-03	2026-04-16 14:20:06.569636-03	2026-04-16 14:20:06.569636-03
6	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: account-opening. Account: income test. Type: income_source. Initial-(account-opening). Amount: 0 usd. Date: 16-04-2026	0.00	8	5	1	5	0.00	5	5	complete	2026-04-16 14:52:53.659-03	2026-04-16 14:52:53.664125-03	2026-04-16 14:52:53.664125-03
7	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: deposit. Account: investment test. Type: investment. Initial-(deposit). Amount: 100 usd. Date: 16-04-2026	100.00	8	2	1	6	100.00	1	6	complete	2026-04-16 14:53:15.388-03	2026-04-16 14:53:15.415237-03	2026-04-16 14:53:15.415237-03
8	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: withdraw. Account slack (bank, ID: 1). Amount:-100 usd. Reference: investment test). Date: 16-04-2026	-100.00	8	1	1	1	-5100.00	1	6	complete	2026-04-16 14:53:15.388-03	2026-04-16 14:53:15.415237-03	2026-04-16 14:53:15.415237-03
9	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: account-opening. Account: test pocket. Type: pocket_saving. Initial-(account-opening). Amount: 0 usd. Date: 16/04/2026, 13:08	0.00	8	5	1	7	0.00	7	7	complete	2026-04-16 15:08:26.142-03	2026-04-16 15:08:26.276255-03	2026-04-16 15:08:26.276255-03
20	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Correction in slack: +5000 usd to revert original "DEPOSIT". For Deletion of test01 account.	5000.00	9	2	1	1	-100.00	1	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
21	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Counterpart Adjustment: -5000 usd from slack. For Deletion of test01 account.	-5000.00	9	1	1	1	-11589.00	1	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
22	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Correction in Test, Debtor: -118 usd to revert original "WITHDRAW". For Deletion of test01 account.	-118.00	9	1	1	3	0.00	3	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
23	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Counterpart Adjustment: +118 usd from Test, Debtor. For Deletion of test01 account.	118.00	9	2	1	1	-11589.00	3	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
24	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Correction in Category/Test/must: -13 usd to revert original "WITHDRAW". For Deletion of test01 account.	-13.00	9	1	1	4	0.00	4	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
25	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Counterpart Adjustment: +13 usd from Category/Test/must. For Deletion of test01 account.	13.00	9	2	1	1	-11589.00	4	1	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
26	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Correction in income test: +1620 usd to revert original "DEPOSIT". For Deletion of test01 account.	1620.00	9	2	1	5	0.00	1	5	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
27	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	RTA Annulment Target(test01).Counterpart Adjustment: -1620 usd from income test. For Deletion of test01 account.	-1620.00	9	1	1	1	-11589.00	1	5	complete	2026-04-19 15:50:47.138-03	2026-04-19 15:50:47.139777-03	2026-04-19 15:50:47.139777-03
28	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: deposit. Account: bank Test 01. Type: bank. Initial-(deposit). Amount: 3000 usd. Date: 19-04-2026	3000.00	8	2	1	8	3000.00	1	8	complete	2026-04-19 15:53:04.434-03	2026-04-19 15:53:04.43988-03	2026-04-19 15:53:04.43988-03
29	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Transaction: withdraw. Account slack (bank, ID: 1). Amount:-3000 usd. Reference: bank Test 01). Date: 19-04-2026	-3000.00	8	1	1	1	-14589.00	1	8	complete	2026-04-19 15:53:04.434-03	2026-04-19 15:53:04.43988-03	2026-04-19 15:53:04.43988-03
\.


--
-- Data for Name: user_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_accounts (account_id, user_id, account_name, account_type_id, currency_id, account_starting_amount, account_balance, note, account_start_date, created_at, updated_at, deleted_at) FROM stdin;
6	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	investment test	2	1	100.00	100.00	\N	2026-04-16 14:52:36.027-03	2026-04-16 14:53:15.415237-03	2026-04-16 14:53:15.419-03	\N
7	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	test pocket	4	1	0.00	0.00	nota de test ..............	2026-04-16 15:08:26.142-03	2026-04-16 15:08:26.276255-03	2026-04-17 18:47:17.912313-03	\N
3	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Test, Debtor	3	1	-2.00	0.00	\N	2026-04-16 09:37:13.126-03	2026-04-16 09:37:13.138104-03	2026-04-19 15:50:47.154-03	\N
4	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	Category/Test/must	5	1	0.00	0.00	\N	2026-04-16 14:20:06.533-03	2026-04-16 14:20:06.569636-03	2026-04-19 15:50:47.156-03	\N
5	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	income test	6	1	0.00	0.00	\N	2026-04-16 14:52:36.027-03	2026-04-16 14:52:53.664125-03	2026-04-19 15:50:47.158-03	\N
1	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	slack	1	1	0.00	-14589.00	\N	2026-04-13 15:53:03.787-03	2026-04-13 15:53:03.786933-03	2026-04-19 15:53:04.434-03	\N
8	ed6cb3fc-df3f-49b3-8791-70160e33c1f0	bank Test 01	1	1	3000.00	3000.00	\N	2026-04-19 15:52:42.719-03	2026-04-19 15:53:04.43988-03	2026-04-19 15:53:04.447-03	\N
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (user_role_id, user_role_name) FROM stdin;
1	user
2	admin
3	super_admin
4	system_admin
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (user_id, username, email, user_firstname, user_lastname, user_contact, password_hashed, currency_id, google_id, display_name, auth_method, user_role_id, created_at, updated_at, deleted_at) FROM stdin;
5f7c9a54-0269-46ad-b757-e966b6aafee4	system_admin	system_admin@fintrack.local	System	Administrator	\N	$2b$10$rXFBPx7/nGuUMo39liV4L.hQYC69yM8qdjftL4Oukf.VWyY36DkBG	\N	\N	\N	password	4	2026-04-12 19:08:14.726685-03	2026-04-12 19:08:14.726685-03	\N
ed6cb3fc-df3f-49b3-8791-70160e33c1f0	test	test@email.com	test01	test01	test01 Contact	$2b$10$9cqnxSQOqdjGBa9exzDEROkcQ90fst9x1HuFAJRdCKToM05TZ9vbi	1	\N	\N	password	1	2026-04-13 15:37:31.866296-03	2026-04-13 22:42:57.127303-03	\N
\.


--
-- Name: app_initialization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_initialization_id_seq', 1, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 5, true);


--
-- Name: transactions_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_transaction_id_seq', 29, true);


--
-- Name: user_accounts_account_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_accounts_account_id_seq', 8, true);


--
-- Name: user_roles_user_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_roles_user_role_id_seq', 1, false);


--
-- Name: account_types account_types_account_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT account_types_account_type_name_key UNIQUE (account_type_name);


--
-- Name: account_types account_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT account_types_pkey PRIMARY KEY (account_type_id);


--
-- Name: app_initialization app_initialization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_initialization
    ADD CONSTRAINT app_initialization_pkey PRIMARY KEY (id);


--
-- Name: category_budget_accounts category_budget_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_budget_accounts
    ADD CONSTRAINT category_budget_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: category_nature_types category_nature_types_category_nature_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_nature_types
    ADD CONSTRAINT category_nature_types_category_nature_type_name_key UNIQUE (category_nature_type_name);


--
-- Name: category_nature_types category_nature_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_nature_types
    ADD CONSTRAINT category_nature_types_pkey PRIMARY KEY (category_nature_type_id);


--
-- Name: currencies currencies_currency_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_currency_code_key UNIQUE (currency_code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (currency_id);


--
-- Name: debtor_accounts debtor_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtor_accounts
    ADD CONSTRAINT debtor_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: income_source_accounts income_source_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_source_accounts
    ADD CONSTRAINT income_source_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: migrations migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_filename_key UNIQUE (filename);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: movement_types movement_types_movement_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_types
    ADD CONSTRAINT movement_types_movement_type_name_key UNIQUE (movement_type_name);


--
-- Name: movement_types movement_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_types
    ADD CONSTRAINT movement_types_pkey PRIMARY KEY (movement_type_id);


--
-- Name: pocket_saving_accounts pocket_saving_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pocket_saving_accounts
    ADD CONSTRAINT pocket_saving_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: refresh_tokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: transaction_types transaction_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_pkey PRIMARY KEY (transaction_type_id);


--
-- Name: transaction_types transaction_types_transaction_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_transaction_type_name_key UNIQUE (transaction_type_name);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: user_accounts user_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: category_budget_accounts category_budget_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_budget_accounts
    ADD CONSTRAINT category_budget_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.user_accounts(account_id) ON DELETE CASCADE;


--
-- Name: category_budget_accounts category_budget_accounts_category_nature_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_budget_accounts
    ADD CONSTRAINT category_budget_accounts_category_nature_type_id_fkey FOREIGN KEY (category_nature_type_id) REFERENCES public.category_nature_types(category_nature_type_id);


--
-- Name: category_budget_accounts category_budget_accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_budget_accounts
    ADD CONSTRAINT category_budget_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: debtor_accounts debtor_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtor_accounts
    ADD CONSTRAINT debtor_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.user_accounts(account_id) ON DELETE CASCADE;


--
-- Name: debtor_accounts debtor_accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtor_accounts
    ADD CONSTRAINT debtor_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: debtor_accounts debtor_accounts_selected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debtor_accounts
    ADD CONSTRAINT debtor_accounts_selected_account_id_fkey FOREIGN KEY (selected_account_id) REFERENCES public.user_accounts(account_id) ON DELETE SET NULL;


--
-- Name: income_source_accounts income_source_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_source_accounts
    ADD CONSTRAINT income_source_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.user_accounts(account_id) ON DELETE CASCADE;


--
-- Name: income_source_accounts income_source_accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_source_accounts
    ADD CONSTRAINT income_source_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pocket_saving_accounts pocket_saving_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pocket_saving_accounts
    ADD CONSTRAINT pocket_saving_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.user_accounts(account_id) ON DELETE CASCADE;


--
-- Name: pocket_saving_accounts pocket_saving_accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pocket_saving_accounts
    ADD CONSTRAINT pocket_saving_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.user_accounts(account_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_destination_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES public.user_accounts(account_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_movement_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_movement_type_id_fkey FOREIGN KEY (movement_type_id) REFERENCES public.movement_types(movement_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.user_accounts(account_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_transaction_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_type_id_fkey FOREIGN KEY (transaction_type_id) REFERENCES public.transaction_types(transaction_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_accounts user_accounts_account_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_account_type_id_fkey FOREIGN KEY (account_type_id) REFERENCES public.account_types(account_type_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_accounts user_accounts_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_accounts user_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_accounts
    ADD CONSTRAINT user_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(currency_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_user_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_role_id_fkey FOREIGN KEY (user_role_id) REFERENCES public.user_roles(user_role_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

