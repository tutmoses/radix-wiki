use scrypto::prelude::*;

#[derive(ScryptoSbor)]
pub struct Status {
    pub price: Decimal,
    pub amount: Decimal,
}

#[blueprint]
mod gumball_machine {
    struct GumballMachine {
        gum_resource_manager: ResourceManager,
        gumballs: Vault,
        collected_xrd: Vault,
        price: Decimal,
    }

    impl GumballMachine {
        pub fn instantiate(price: Decimal) -> Global<GumballMachine> {
            let gumballs = ResourceBuilder::new_fungible(OwnerRole::None)
                .metadata(metadata!(
                    init {
                        "name" => "Gumball", locked;
                        "symbol" => "GUM", locked;
                    }
                ))
                .mint_initial_supply(100)
                .into();

            Self {
                gum_resource_manager: gumballs.resource_manager(),
                gumballs: Vault::with_bucket(gumballs),
                collected_xrd: Vault::new(XRD),
                price,
            }
            .instantiate()
            .prepare_to_globalize(OwnerRole::None)
            .globalize()
        }

        pub fn buy_gumball(&mut self, mut payment: Bucket) -> (Bucket, Bucket) {
            let cost = self.price.clone();
            let our_share = payment.take(cost);
            self.collected_xrd.put(our_share);
            (self.gumballs.take(1), payment)
        }

        pub fn get_status(&self) -> Status {
            Status {
                price: self.price.clone(),
                amount: self.gumballs.amount(),
            }
        }
    }
}