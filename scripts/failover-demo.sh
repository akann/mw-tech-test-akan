#¡/bin/bash

# This script demonstrates the failover scenario where the primary provider Super Car fails to respond to a request.
# The system should be able to switch to the secondary provider and return a valuation.
# It will revert back to the primary provider after cool down period.
#
# To run this script, you need to do the following:
#  1. change the primary provider "SUPER_CAR_BASE_URL" URL in the .env.demo file to a non-existent URL
#  2. Run the application: npm run demo
#  3. Run this script: ./scripts/failover-demo.sh

echo "Emptying the database..."

sqlite3 database/valuations-dev.sqlite "DELETE FROM vehicle_valuation"
sqlite3 database/valuations-dev.sqlite "SELECT count(*) as num_of_valuations from vehicle_valuation"

sqlite3 database/valuations-dev.sqlite "DELETE FROM provider_log"
sqlite3 database/valuations-dev.sqlite "SELECT count(*) as num_of_valuations from provider_log"

for num in {1..40}
 do
    VRM=$(printf "ABC12%02d" "$num")
    echo
    echo "Creating a new valuation (${VRM})..."

    curl -s --request PUT --header 'Content-Type: application/json' --data '{"mileage": 10000}' http://localhost:3000/valuations/${VRM}

    echo
    echo
    echo "Checking the valuation from DB..."
    printf '%s' "Valuation: "
    sqlite3 database/valuations-dev.sqlite "SELECT * from vehicle_valuation WHERE vrm='${VRM}'"
    echo
    printf '%s' "Provider Log: "
    sqlite3 database/valuations-dev.sqlite "SELECT * from provider_log ORDER BY requestDate DESC LIMIT 1"

    echo

    sleep 2
done


