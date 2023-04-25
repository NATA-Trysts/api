@Library('shared-library@master') _

def credentialsId = 'aws_credentials'
def region = 'ap-southeast-1'
def clusterName ='tryst-be-cluster'

def gitCheckoutK8sRepo() {
	sh "git config --global credential.helper cache"
	checkout( scm: [$class: 'GitSCM',
		branches: [[name: 'main']],
		extensions: [[$class: 'RelativeTargetDirectory',
		relativeTargetDir: 'k8s-deployment']],
		userRemoteConfigs: [[credentialsId: '49af3984-8fb6-47f4-bd97-ef161c311d66', url: "https://github.com/NATA-Trysts/k8s-deployment.git"]]],
	changelog: false,
	poll: false ) }


pipeline {

    agent any

    environment {
        GIT_HASH = GIT_COMMIT.take(8)
    }

    stages {
		// stage ('Prepare Environment') {
		// 	steps {
		// 		script {
		// 			sh '''
		// 				echo Preparing Install Docker
		// 				sudo apt-get update
		// 				sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
		// 				echo DONE INSTALL DOCKER
		// 				echo --------------------------------------------------------------------------------

		// 				echo Preparing Install AWS CLI
		// 				sudo apt-get install unzip
		// 				curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
		// 				unzip awscliv2.zip
		// 				sudo ./aws/install
		// 				echo Done Install AWS CLI
		// 				echo --------------------------------------------------------------------------------

		// 				echo Preparing Install kubectl
		// 				curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
		// 				curl -LO "https://dl.k8s.io/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl.sha256"
		// 				echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
		// 				sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
		// 				chmod +x kubectl
		// 				mkdir -p ~/.local/bin
		// 				mv ./kubectl ~/.local/bin/kubectl
		// 				kubectl version --client
		// 				echo Done Install kubectl
		// 				echo --------------------------------------------------------------------------------
		// 			'''
		// 		}
		// 	}
		// }

        stage('Build') {
            steps {
                script {
                    // hostIP = sh (
                    //     script: """
                    //         hostname -I
                    //     """,
                    //     returnStdout: true
                    // ).trim()
					// docker network create -o "com.docker.network.bridge.host_binding_ipv4"="${hostIP}" my-network
                    // docker build --network my-network -t app .
                    sh """
                       sudo docker build -t trysts/api:$GIT_HASH .
                    """
                }
            }
        }

        stage('Push') {
            steps{
                pushImageToRepo('api',GIT_HASH)
            }
        }

        stage ('Deploy') {
            steps {
				script {
					// gitCheckoutK8sRepo()
					sh "pwd"
                	deployImage('api',credentialsId,clusterName,region,GIT_HASH)
				}
            }
        }
    }


}
