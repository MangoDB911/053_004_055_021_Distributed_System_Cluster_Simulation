# Distributed_System_Cluster_Simulation

* After cloning the repo, make sure to create a virtual environment [`python -m venv venv`] in the folder where this repo is cloned. *

## **Week** 1️⃣

1. API server base implementation using flask, flask-cors.
2. Adding a node -> Provide CPU cores to join the cluster.

### **Testing** 🧪

***GET*** & ***POST*** tested using *Postman* 📫

============================================================================

## **Week** 2️⃣

1. Implementation of Pod scheduler & Health monitor with node heartbeat mechanism
2. Launch a pod -> request a pod with CPU: System assigns it automatically

~~Pod scheduling done using **Best-fit** algorithm~~

### **Testing** 🧪🧪

POSTMAN 📫

***GET*** & ***POST*** to localhost:5000/nodes (for node creation)  
***GET*** & ***POST*** to localhost:5000/pods (for pod scheduling)

===========================================================================

## **Week** 3️⃣

Added a web interface to simplify node creation and pod scheduling
--> System Testing 🧪🧪🧪 & Final documentation 📃
