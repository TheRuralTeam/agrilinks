
> vite_react_shadcn_ts@0.0.0 type-check:strict
> tsc -p tsconfig.strict.json --noEmit

src/components/admin/AdminManagement.tsx(187,15): error TS2322: Type '{ is_root_admin: boolean; is_super_root: any; permissions: ("manage_users" | "manage_products" | "manage_orders" | "manage_support" | "manage_sourcing" | "view_analytics" | "manage_admins")[]; ... 4 more ...; created_at: string | null; }[]' is not assignable to type 'AdminUser[]'.
  Type '{ is_root_admin: boolean; is_super_root: any; permissions: ("manage_users" | "manage_products" | "manage_orders" | "manage_support" | "manage_sourcing" | "view_analytics" | "manage_admins")[]; ... 4 more ...; created_at: string | null; }' is not assignable to type 'AdminUser'.
    Types of property 'created_at' are incompatible.
      Type 'string | null' is not assignable to type 'string'.
        Type 'null' is not assignable to type 'string'.
src/components/admin/DeliveryTracking.tsx(143,37): error TS2345: Argument of type '{ created_at: string | null; id: string; location: string; pre_order_id: string | null; product_id: string; quantity: number; status: string; total_price: number; transport_fee: number | null; updated_at: string | null; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Order[]>'.
  Type '{ created_at: string | null; id: string; location: string; pre_order_id: string | null; product_id: string; quantity: number; status: string; total_price: number; transport_fee: number | null; updated_at: string | null; user_id: string; }[]' is not assignable to type 'Order[]'.
    Type '{ created_at: string | null; id: string; location: string; pre_order_id: string | null; product_id: string; quantity: number; status: string; total_price: number; transport_fee: number | null; updated_at: string | null; user_id: string; }' is not assignable to type 'Order'.
      Types of property 'created_at' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/components/admin/DeliveryTracking.tsx(145,35): error TS2345: Argument of type '{ id: string; full_name: string; email: string | null; phone: string | null; user_type: "agente" | "agricultor" | "comprador" | "motorista" | null; avatar_url: string | null; province_id: string | null; municipality_id: string | null; }[]' is not assignable to parameter of type 'SetStateAction<UserInfo[]>'.
  Type '{ id: string; full_name: string; email: string | null; phone: string | null; user_type: "agente" | "agricultor" | "comprador" | "motorista" | null; avatar_url: string | null; province_id: string | null; municipality_id: string | null; }[]' is not assignable to type 'UserInfo[]'.
    Type '{ id: string; full_name: string; email: string | null; phone: string | null; user_type: "agente" | "agricultor" | "comprador" | "motorista" | null; avatar_url: string | null; province_id: string | null; municipality_id: string | null; }' is not assignable to type 'UserInfo'.
      Types of property 'province_id' are incompatible.
        Type 'string | null' is not assignable to type 'string | undefined'.
          Type 'null' is not assignable to type 'string | undefined'.
src/components/ProductCard.tsx(430,98): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(432,88): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(447,52): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(450,76): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(455,9): error TS2322: Type 'string | null | undefined' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/components/ProductCard.tsx(471,97): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(473,87): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(492,51): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(495,64): error TS18047: 'user' is possibly 'null'.
src/components/ProductCard.tsx(496,13): error TS2322: Type '{ user_name: string; user_type: "agente" | "agricultor" | "comprador" | "motorista"; comment_id?: string | undefined; created_at?: string | undefined; id?: string | undefined; reply_text?: string | undefined; user_id?: string | undefined; }' is not assignable to type 'CommentReply'.
  Types of property 'id' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
      Type 'undefined' is not assignable to type 'string'.
src/components/ProductCatalog.tsx(41,21): error TS2345: Argument of type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Product[]>'.
  Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to type 'Product[]'.
    Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }' is not assignable to type 'Product'.
      Types of property 'description' are incompatible.
        Type 'string | null' is not assignable to type 'string | undefined'.
          Type 'null' is not assignable to type 'string | undefined'.
src/contexts/AuthContext.tsx(120,22): error TS2345: Argument of type '{ user_type: "agente" | "agricultor" | "comprador" | "motorista"; agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; ... 14 more ...; verified_by: string | null; } | null' is not assignable to parameter of type 'SetStateAction<User | null>'.
  Type '{ user_type: "agricultor" | "agente" | "comprador" | "motorista"; agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; ... 14 more ...; verified_by: string | null; }' is not assignable to type 'SetStateAction<User | null>'.
    Type '{ user_type: "agricultor" | "agente" | "comprador" | "motorista"; agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; ... 14 more ...; verified_by: string | null; }' is not assignable to type 'User'.
      Types of property 'identity_document' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/contexts/AuthContext.tsx(231,9): error TS2322: Type 'string | null' is not assignable to type 'null'.
  Type 'string' is not assignable to type 'null'.
src/features/products/productsService.ts(115,41): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | null' is not assignable to parameter of type 'string | number | Date'.
      Type 'null' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | null' is not assignable to parameter of type 'string | number'.
      Type 'null' is not assignable to type 'string | number'.
src/features/products/productsService.ts(120,41): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | null' is not assignable to parameter of type 'string | number | Date'.
      Type 'null' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | null' is not assignable to parameter of type 'string | number'.
      Type 'null' is not assignable to type 'string | number'.
src/lib/publicData.test.ts(18,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(19,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(20,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(21,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(22,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(39,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(40,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(41,12): error TS18047: 'safe' is possibly 'null'.
src/lib/publicData.test.ts(42,12): error TS18047: 'safe' is possibly 'null'.
src/pages/AdminDashboard.tsx(350,27): error TS2345: Argument of type '{ created_at: string | null; id: string; location: string; product_id: string; quantity: number; status: string; updated_at: string | null; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Order[]>'.
  Type '{ created_at: string | null; id: string; location: string; product_id: string; quantity: number; status: string; updated_at: string | null; user_id: string; }[]' is not assignable to type 'Order[]'.
    Type '{ created_at: string | null; id: string; location: string; product_id: string; quantity: number; status: string; updated_at: string | null; user_id: string; }' is not assignable to type 'Order'.
      Types of property 'created_at' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/pages/AdminDashboard.tsx(368,19): error TS2345: Argument of type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Product[]>'.
  Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to type 'Product[]'.
    Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }' is not assignable to type 'Product'.
      Types of property 'created_at' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/pages/AdminDashboard.tsx(369,16): error TS2345: Argument of type '{ agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; full_name: string; id: string; identity_document: string | null; ... 12 more ...; verified_by: string | null; }[]' is not assignable to parameter of type 'SetStateAction<User[]>'.
  Type '{ agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; full_name: string; id: string; identity_document: string | null; ... 12 more ...; verified_by: string | null; }[]' is not assignable to type 'User[]'.
    Type '{ agent_code: string | null; avatar_url: string | null; created_at: string | null; email: string | null; email_verified: boolean | null; full_name: string; id: string; identity_document: string | null; ... 12 more ...; verified_by: string | null; }' is not assignable to type 'User'.
      Types of property 'is_root_admin' are incompatible.
        Type 'boolean | null' is not assignable to type 'boolean | undefined'.
          Type 'null' is not assignable to type 'boolean | undefined'.
src/pages/AdminDashboard.tsx(372,17): error TS2345: Argument of type '{ created_at: string | null; descricao_final: string | null; embalagem: string | null; id: string; locais_entrega: Json; nome_ficha: string; observacoes: string | null; produto: string; ... 5 more ...; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Ficha[]>'.
  Type '{ created_at: string | null; descricao_final: string | null; embalagem: string | null; id: string; locais_entrega: Json; nome_ficha: string; observacoes: string | null; produto: string; ... 5 more ...; user_id: string; }[]' is not assignable to type 'Ficha[]'.
    Type '{ created_at: string | null; descricao_final: string | null; embalagem: string | null; id: string; locais_entrega: Json; nome_ficha: string; observacoes: string | null; produto: string; ... 5 more ...; user_id: string; }' is not assignable to type 'Ficha'.
      Types of property 'qualidade' are incompatible.
        Type 'string | null' is not assignable to type 'string | undefined'.
          Type 'null' is not assignable to type 'string | undefined'.
src/pages/AppHome.tsx(280,20): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/AppHome.tsx(280,50): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/AppHome.tsx(287,23): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/AppHome.tsx(287,53): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/B2BProfile.tsx(70,19): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/B2BProfile.tsx(99,9): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/pages/B2BProfile.tsx(106,26): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/B2BProfile.tsx(267,48): error TS2698: Spread types may only be created from object types.
src/pages/Dashboard.tsx(85,13): error TS2538: Type 'null' cannot be used as an index type.
src/pages/Dashboard.tsx(85,38): error TS2538: Type 'null' cannot be used as an index type.
src/pages/Dashboard.tsx(103,19): error TS2345: Argument of type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<Product[]>'.
  Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }[]' is not assignable to type 'Product[]'.
    Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }' is not assignable to type 'Product'.
      Types of property 'created_at' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/pages/FarmerFormWithAuth.tsx(86,10): error TS2769: No overload matches this call.
  Overload 1 of 2, '(values: { category?: string | null | undefined; contact: string; created_at?: string | null | undefined; description?: string | null | undefined; farmer_name: string; harvest_date: string; ... 12 more ...; user_id: string; }, options?: { ...; } | undefined): PostgrestFilterBuilder<...>', gave the following error.
    Type 'string | undefined' is not assignable to type 'string'.
      Type 'undefined' is not assignable to type 'string'.
  Overload 2 of 2, '(values: { category?: string | null | undefined; contact: string; created_at?: string | null | undefined; description?: string | null | undefined; farmer_name: string; harvest_date: string; ... 12 more ...; user_id: string; }[], options?: { ...; } | undefined): PostgrestFilterBuilder<...>', gave the following error.
    Object literal may only specify known properties, and 'user_id' does not exist in type '{ category?: string | null | undefined; contact: string; created_at?: string | null | undefined; description?: string | null | undefined; farmer_name: string; harvest_date: string; id?: string | undefined; ... 11 more ...; user_id: string; }[]'.
src/pages/Messages.tsx(318,36): error TS2345: Argument of type '{ url: string; name: string; size: number; }' is not assignable to parameter of type 'never'.
src/pages/PerfilComprador.tsx(97,24): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/PerfilComprador.tsx(138,79): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/PerfilComprador.tsx(175,24): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(268,89): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(277,23): error TS2345: Argument of type '{ status: "active" | "inactive" | "removed"; views: number; interests: number; category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; ... 12 more ...; user_id: string; }[]' is not assignable to parameter of type 'SetStateAction<UserProduct[]>'.
  Type '{ status: "active" | "inactive" | "removed"; views: number; interests: number; category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; ... 12 more ...; user_id: string; }[]' is not assignable to type 'UserProduct[]'.
    Type '{ status: "active" | "inactive" | "removed"; views: number; interests: number; category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; ... 12 more ...; user_id: string; }' is not assignable to type 'UserProduct'.
      Types of property 'created_at' are incompatible.
        Type 'string | null' is not assignable to type 'string'.
          Type 'null' is not assignable to type 'string'.
src/pages/Profile.tsx(291,80): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(302,117): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(319,98): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(327,133): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(328,132): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Profile.tsx(405,117): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/SearchPage.tsx(239,20): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(239,50): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(246,23): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(246,53): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(379,20): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(379,50): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(386,23): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/SearchPage.tsx(386,53): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
src/pages/TechnicalSheet.tsx(53,22): error TS2345: Argument of type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }' is not assignable to parameter of type 'SetStateAction<Product | null>'.
  Type '{ category: string | null; contact: string; created_at: string | null; description: string | null; farmer_name: string; harvest_date: string; id: string; location_lat: number | null; ... 10 more ...; user_id: string; }' is not assignable to type 'Product'.
    Types of property 'description' are incompatible.
      Type 'string | null' is not assignable to type 'string | undefined'.
        Type 'null' is not assignable to type 'string | undefined'.
src/pages/TechnicalSheet.tsx(126,19): error TS2345: Argument of type 'undefined' is not assignable to parameter of type 'string'.
src/pages/TechnicalSheet.tsx(128,19): error TS2345: Argument of type 'undefined' is not assignable to parameter of type 'string'.
src/pages/UserProfile.tsx(120,19): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/UserProfile.tsx(124,19): error TS2345: Argument of type '{ id: string; full_name: string; avatar_url: string | null; user_type: "agente" | "agricultor" | "comprador" | "motorista" | null; province_id: string | null; municipality_id: string | null; created_at: string | null; phone: string | null; agent_code: string | null; verified: boolean; }' is not assignable to parameter of type 'SetStateAction<UserData | null>'.
  Type '{ id: string; full_name: string; avatar_url: string | null; user_type: "agente" | "agricultor" | "comprador" | "motorista" | null; province_id: string | null; municipality_id: string | null; created_at: string | null; phone: string | null; agent_code: string | null; verified: boolean; }' is not assignable to type 'UserData'.
    Types of property 'province_id' are incompatible.
      Type 'string | null' is not assignable to type 'string'.
        Type 'null' is not assignable to type 'string'.
src/pages/UserProfile.tsx(131,26): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/UserProfile.tsx(173,87): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/UserProfile.tsx(179,89): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Wallet.tsx(141,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/pages/Wallet.tsx(196,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
